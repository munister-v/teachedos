(function () {
  let reviewedBoard = null;

  const mobileLabels = {
    dashboard: ['Overview', 'Priority actions and platform health'],
    users: ['People', 'Accounts, access and plans'],
    boards: ['Boards', 'Content health and ownership'],
    sessions: ['Sessions', 'Active access'],
    security: ['Security', 'Access protection'],
    audit: ['Audit', 'Recorded changes'],
    billing: ['Billing', 'Plans and payments'],
    packages: ['Packages', 'Plan controls'],
    settings: ['Settings', 'Platform configuration'],
    'api-tester': ['Developer', 'Internal API tools'],
  };

  const originalMobileHeader = window.updateMobileHeader;
  window.updateMobileHeader = function updateControlMobileHeader(name) {
    originalMobileHeader?.(name);
    const label = mobileLabels[name];
    if (!label) return;
    const title = document.getElementById('mobile-page-title');
    const sub = document.getElementById('mobile-page-sub');
    if (title) title.textContent = label[0];
    if (sub) sub.textContent = label[1];
  };

  window.renderPriorityQueue = function renderPriorityQueue(stats = {}, system = {}, health = null) {
    const list = document.getElementById('priority-queue-list');
    const state = document.getElementById('priority-queue-state');
    if (!list || !state) return;

    const items = [];
    const expiredSessions = Number(system.expiredSessions || 0);
    const expiredInvites = Number(system.invites?.expired || 0);
    const failedLogins = Number(stats.failedLogins24h || 0);
    const lockedAccounts = Number(stats.locked || 0);
    const pendingPayments = Number(stats.pendingPayments || 0);

    if (!health?.ok) {
      items.push({ tone: 'risk', title: 'Backend health needs review', copy: 'The API health endpoint did not return a healthy response.', action: 'Open settings', run: "showPage('settings')" });
    }
    if (pendingPayments) {
      items.push({ tone: 'watch', title: `${pendingPayments} payment request${pendingPayments === 1 ? '' : 's'} waiting`, copy: 'Review the payment queue before the next access cycle.', action: 'Review billing', run: "showPage('billing')" });
    }
    if (lockedAccounts || failedLogins) {
      items.push({ tone: lockedAccounts ? 'risk' : 'watch', title: lockedAccounts ? `${lockedAccounts} locked account${lockedAccounts === 1 ? '' : 's'}` : `${failedLogins} failed sign-in attempt${failedLogins === 1 ? '' : 's'} today`, copy: 'Review authentication activity and restore access only where appropriate.', action: 'Review security', run: "showPage('security')" });
    }
    if (expiredSessions) {
      items.push({ tone: 'watch', title: `${expiredSessions} expired session${expiredSessions === 1 ? '' : 's'} to clear`, copy: 'Remove expired records to keep the session store tidy.', action: 'Clear sessions', run: 'purgeExpiredSessions()' });
    }
    if (expiredInvites) {
      items.push({ tone: 'watch', title: `${expiredInvites} expired invite${expiredInvites === 1 ? '' : 's'}`, copy: 'Review expired invitations and send a fresh link where onboarding is still expected.', action: 'Open invites', run: "showPage('settings')" });
    }
    if (!items.length) {
      items.push({ tone: 'good', title: 'No operational blockers', copy: 'Access, payments and platform signals are clear. Use this time for a short content or growth review.', action: 'Open audit', run: "showPage('audit')" });
    }

    const visible = items.slice(0, 3);
    state.textContent = visible[0]?.tone === 'good' ? 'Clear' : `${items.length} to review`;
    list.innerHTML = visible.map(item => `
      <article class="priority-item is-${item.tone}">
        <div>
          <div class="priority-title">${esc(item.title)}</div>
          <div class="priority-copy">${esc(item.copy)}</div>
          <button class="priority-action" type="button" onclick="${escAttr(item.run)}">${esc(item.action)}</button>
        </div>
      </article>
    `).join('');
  };

  window.openBoardReview = async function openBoardReview(id) {
    const modal = document.getElementById('modal-board-review');
    const title = document.getElementById('board-review-title');
    const meta = document.getElementById('board-review-meta');
    const grid = document.getElementById('board-review-grid');
    if (!modal || !title || !meta || !grid) return;

    reviewedBoard = null;
    title.textContent = 'Loading board';
    meta.textContent = 'Fetching ownership and content health.';
    grid.innerHTML = '';
    modal.classList.add('open');
    try {
      const response = await api('GET', `/api/admin/boards/${encodeURIComponent(id)}/inspection`);
      const board = response.board;
      reviewedBoard = board;
      title.textContent = board.name || 'Untitled board';
      meta.textContent = `Owned by ${board.owner_name || board.owner_email || 'Unknown'} · last updated ${fmtRelative(board.updated_at)}`;
      const healthText = board.health === 'empty' ? 'Empty board' : board.health === 'stale' ? 'Needs review' : 'Healthy';
      grid.innerHTML = [
        ['Content', `${board.cards_count || 0} cards`],
        ['Storage', fmtBytes(board.data_bytes)],
        ['Health', healthText],
      ].map(([label, value]) => `<div class="board-review-stat"><div class="board-review-stat-label">${esc(label)}</div><div class="board-review-stat-value">${esc(value)}</div></div>`).join('');
      document.getElementById('board-transfer-email').value = '';
    } catch (error) {
      title.textContent = 'Board review unavailable';
      meta.textContent = error.message || 'The board details could not be loaded.';
      grid.innerHTML = '';
    }
  };

  window.closeBoardReview = function closeBoardReview(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modal-board-review')?.classList.remove('open');
    reviewedBoard = null;
  };

  window.openReviewedBoard = function openReviewedBoard() {
    if (reviewedBoard?.id) openBoard(reviewedBoard.id);
  };

  window.openReviewedOwner = function openReviewedOwner() {
    if (!reviewedBoard?.owner_email) return;
    closeBoardReview();
    showPage('users');
    resetPeopleFilters(reviewedBoard.owner_email);
  };

  window.transferBoardOwnership = function transferBoardOwnership() {
    if (!reviewedBoard?.id) return;
    const emailInput = document.getElementById('board-transfer-email');
    const email = String(emailInput?.value || '').trim().toLowerCase();
    if (!email) {
      toast('Enter the new owner email first.', 'error');
      emailInput?.focus();
      return;
    }
    if (email === String(reviewedBoard.owner_email || '').toLowerCase()) {
      toast('This person already owns the board.', 'error');
      return;
    }
    confirm(
      `Transfer "${reviewedBoard.name}"?`,
      `Ownership will move to ${email}. The previous owner will no longer control this board.`,
      '!',
      async () => {
        try {
          await api('POST', `/api/admin/boards/${reviewedBoard.id}/transfer`, { email });
          toast('Board ownership transferred', 'success');
          closeBoardReview();
          loadBoards();
          refreshStats();
        } catch (error) {
          toast(error.message || 'Could not transfer the board.', 'error');
        }
      },
      { label: 'Transfer ownership', color: 'var(--control-violet)' }
    );
  };

  window.bulkSetAccess = function bulkSetAccess(action) {
    const ids = [...selectedUserIds];
    if (!ids.length) return;
    const isSuspend = action === 'suspend';
    const verb = isSuspend ? 'Suspend' : 'Restore access for';
    const description = isSuspend
      ? 'Selected accounts will be signed out immediately and will not be able to sign in until restored.'
      : 'Selected accounts will be allowed to sign in again.';
    confirm(`${verb} ${ids.length} people?`, description, '!', async () => {
      let completed = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          if (isSuspend) await api('POST', `/api/admin/users/${id}/suspend`, { reason: 'Bulk action from control center' });
          else await api('POST', `/api/admin/users/${id}/unsuspend`);
          completed += 1;
        } catch (_) {
          failed += 1;
        }
      }
      toast(`${completed} account${completed === 1 ? '' : 's'} updated${failed ? `, ${failed} unchanged` : ''}`, failed && !completed ? 'error' : 'success');
      clearBulk();
      loadUsers();
      refreshStats();
    }, { label: isSuspend ? 'Suspend access' : 'Restore access', color: isSuspend ? 'var(--admin-danger)' : 'var(--control-violet)' });
  };

  window.setTimeout(() => {
    if (document.getElementById('page-dashboard')?.classList.contains('active')) manualRefresh();
  }, 0);
}());
