# TeachEd AI Assistant Plan

## Goal
Create a teacher-first AI assistant that helps build boards, lesson flows, exercises, homework and reusable materials without breaking the current manual workflow.

## MVP Scope
- Board helper: generate a clean board structure from topic, level, duration and skill focus.
- Selected-card helper: rewrite, simplify, translate, explain, expand or turn selected content into tasks.
- Lesson flow helper: produce warm-up, presentation, controlled practice, freer practice, homework and reflection stages.
- Game helper: convert vocabulary or text into matching, sorting, gap-fill, true/false and discussion games.
- Export helper: create teacher notes, student handout and homework summary from a board.

## Board UX
- Add an AI button in the left toolbar that opens a dedicated assistant panel.
- Support context actions when cards are selected: improve text, create questions, make vocabulary, summarize, generate next activity.
- Generated boards must use existing card types and automatic layered placement.
- Every AI action should preview before applying, with "Apply to board" and "Copy" actions.
- Keep teacher control: no silent overwrites, no deleting existing cards without confirmation.

## Data Model
- Store AI generations as regular cards, stages and lesson metadata.
- Add optional `ai` metadata to generated cards: prompt, source, createdAt, model, confidence.
- Save reusable prompts/templates in local storage first, then backend when VPS API is ready.

## No-Key Local Strategy
- Default mode: local teacher templates with no external API, no keys and no cost.
- Teacher memory: style, correction approach, preferred activities and pacing.
- Student memory: age, interests, goals, motivation, class context and weak spots.
- Mistake memory: recurring grammar, vocabulary, writing, speaking or pronunciation problems.
- Output modes: full lesson board, quick activities, homework pack, mistake clinic and game pack.
- Context actions: use selected cards, learn from recent board content and apply quick templates.
- Generated boards should include lesson stages, vocabulary, memory notes, warm-up prompts, success criteria, teacher script and challenge tasks.
- Future backend AI should be optional; the product must stay useful without paid APIs.

## Safety & Quality
- Always show generated content before inserting.
- Keep sources visible when generation is based on pasted text.
- Add language/level controls: CEFR, student age, lesson goal, teacher language.
- Add fallback templates for offline/demo mode.

## Milestones
1. UI shell and plan panel on board.
2. Local template generator without API.
3. Selected-card AI actions.
4. Full lesson/board generator.
5. Backend API, quotas and admin controls.
6. Community-ready AI board templates.
