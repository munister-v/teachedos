"""Shared bits for the newer Picture Studio scenes: word helpers and the save step."""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


def words(S):
    def R(rid, word, box, label, level, ipa, d, ex, us=None):
        card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
        if us:
            card["us"] = us
        S.room(rid, word, box, label, **card)

    def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
        card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
        if us:
            card["us"] = us
        S.part(pid, word, pin, box, **card)
    return R, P


def finish(S, TF, PROMPTS):
    for coll in (S.rooms, S.parts):
        for c in coll:
            c["def"] = c.pop("def_")
    bad = [p["id"] for p in S.parts if not (p["box"][0] <= p["pin"][0] <= p["box"][0] + p["box"][2]
                                            and p["box"][1] <= p["pin"][1] <= p["box"][1] + p["box"][3])]
    assert not bad, f"pins outside their box: {bad}"
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
    S.save(os.path.join(out, f"{S.id}.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
    S.svg(os.path.join(ROOT, "out", f"{S.id}.svg"))
    lv = {}
    for p in S.parts + S.rooms:
        lv[p["level"]] = lv.get(p["level"], 0) + 1
    print(f"{S.id}: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
          f"{os.path.getsize(os.path.join(out, S.id + '.json')) // 1024} KB")
