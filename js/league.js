'use strict';

// リーグ全体の進行：日程・オーダー・経営・オフシーズン

let S = null; // いまのゲームの状態（まるごと保存する）

function myTeam() { return S.teams[S.myTeamId]; }
function teamPlayers(t) { return t.players.map(id => S.players[id]); }
function addNews(text, kind) {
  const n = { y: S.year, d: curDateLabel(), text, kind: kind || '' };
  S.news.unshift(n);
  if (S.news.length > 80) S.news.length = 80;
  return n;
}

// ユニバースシリーズは、試合を見るまで結果を隠す（元のペナント監督の人の言葉 2026-11-02「結果が分からないから追うのが楽しい」）
function pbpUnseen(i) { const g = S.pbp && S.pbp[i]; return !!g && !g.seen; }
function pbpUnseenKind(kind) { return (S.pbp || []).some(g => g.kind === kind && !g.seen); }

function dateLabel(e) { return `${e.m}/${e.d}(${WEEKDAYS[e.w]})`; }
function curDateLabel() {
  if (S.phase === 'post') return 'ポストシーズン';
  if (S.phase === 'off' || !S.schedule.length) return 'オフ';
  return dateLabel(S.schedule[Math.min(S.day, S.schedule.length - 1)]);
}
function gamesPlayed(t) { return t.w + t.l + t.d; }

function newFin() { return { gate: 0, food: 0, tv: 0, ltv: 0, goods: 0, sponsor: 0, other: 0, share: 0, luxIn: 0, salary: 0, ops: 0, invest: 0, lux: 0 }; }

// ---------- 新しいゲーム ----------
const MINOR_PAY = 4; // マイナー契約の選手の年俸（万ドル。仮・AI）
function newGame(myTeamId, games) {
  S = {
    version: 1, year: 2027, day: 0, games, myTeamId, phase: 'season', meritBase: true,
    teams: [], players: {}, nextPid: 1, schedule: [], news: [], history: [], awardHist: [], records: { season: {} }, retired: [],
    lastGame: null, myGames: [], off: null, post: null, popups: [], freeAgents: [], pickTrades: [], draftNext: null,
  };
  TEAM_DEFS.forEach((d, i) => {
    const big = d.mk === '大' ? 1 : d.mk === '小' ? -1 : 0;
    const t = {
      id: i, name: d.name, short: d.short, color: d.color, lg: d.lg, div: d.div, mk: d.mk, rival: i < 15 ? i + 15 : i - 15,
      players: [], active: [], lineup: [], rotation: [], closer: null, setup: null, rotIdx: 0,
      w: 0, l: 0, d: 0, rs: 0, ra: 0, luxYears: 0,
      money: Math.round(8000 + big * 4000 + U.rint(0, 10) * 300), pop: U.rint(40, 60) + big * 7, goods: [], nextGoodsId: 1,
      fac: { train: 1, stadium: 1, scout: 1, medical: 1, dorm: 1, gym: 1, analysis: 1 }, promoUsed: [], intensity: '普通', fin: newFin(),
    };
    if (i !== myTeamId) t.fac.train = U.rint(1, 3);
    S.teams.push(t);
    const tq = 64 + U.gauss() * 1.4 + big * 0.8; // 球団の力のばらつき（1 年目に 55〜105 勝くらいになるように。仮・AI）
    // 40 人枠：野手 20 人（うちレギュラー 8 人）と投手 20 人（先発 5・中継ぎ 8・控え 7）
    const fpos = ['捕', '捕', '捕', '一', '一', '二', '二', '三', '三', '遊', '遊', '外', '外', '外', '外', '外', '外', '二', '三', '外'];
    const regular = new Set([0, 3, 5, 7, 9, 11, 12, 13]);
    fpos.forEach((pos, j) => {
      const age = U.rint(22, 35);
      const q = (regular.has(j) ? tq + 4 : tq - 6) + U.gauss() * 5 - Math.max(0, 25 - age) * 2;
      sign40(t, newPlayer(S, { pos, q, age }));
    });
    for (let j = 0; j < 20; j++) {
      const age = U.rint(22, 35);
      const q = (j < ROTATION_SIZE ? tq + 3 : j < 13 ? tq - 1 : tq - 7) + U.gauss() * 5 - Math.max(0, 25 - age) * 2;
      sign40(t, newPlayer(S, { isP: true, role: j < ROTATION_SIZE + 2 ? '先発' : '中継', q, age }));
    }
    // マイナー契約：若い有望株と、中堅・ベテラン
    for (let j = 0; j < MINOR_MAX; j++) {
      const isP = j % 2 === 0;
      signPlayer(t, newMinorPlayer(tq, isP ? { isP: true, role: j % 6 === 0 ? '先発' : '中継' } : { pos: U.pick(['捕', '一', '二', '三', '遊', '外', '外', '遊', '捕']) }));
    }
    teamPlayers(t).forEach(p => initService(p, t));
    autoActive(t);
    autoLineup(t); autoRotation(t);
    assignLevels(t, true);
  });
  // 26 人枠の若い投手の中から 2 人だけ、最初から二刀流にする（打っても主力になれるくらい）
  U.shuffle(S.teams.flatMap(t => activePlayers(t).filter(p => p.isP && p.age <= 26 && ovr(p) >= 55))).slice(0, 2)
    .forEach(p => { makeTwoWay(p, Math.max(ovr(p), 62)); autoLineup(S.teams[p.teamId]); });
  addIndependentFAs(20);
  // 最初の年のドラフトの順番は、前の年の成績の代わりに、力の弱い球団から
  S.draftNext = makeDraftOrder(S.teams.map(t => ({ id: t.id, v: teamPower(t) + U.gauss() * 2 })).sort((a, b) => a.v - b.v).map(x => x.id), []);
  startSeason();
  addNews(`${myTeam().name}の監督に就任しました。目指せユニバースシリーズ制覇！`, 'big');
}
// 球団の力の目安（26 人枠の総合の平均）
function teamPower(t) { const ps = activePlayers(t); return ps.length ? U.sum(ps, ovr) / ps.length : 0; }

// 最初からいる選手のメジャーの年数（年齢から見積もる）と契約
function initService(p, t) {
  p.signYear = S.year - U.clamp(p.age - 18 - U.rint(0, 3), 0, 12);
  p.signAge = p.age - (S.year - p.signYear);
  p.meritBase = startMerit(p, p.age);
  if (!p.on40) { p.svc = p.age >= 27 && U.chance(0.3) ? U.rnd(0, 2) : 0; p.salary = MINOR_PAY; return; }
  p.svc = U.clamp((p.age - 22) * U.rnd(0.5, 1) + (ovr(p) >= 60 ? 0.5 : 0), 0, 16);
  const mv = calcSalary(p);
  if (p.svc >= FA_YEARS) { // FA で結んだ契約の途中
    p.salary = Math.max(MIN_SALARY, Math.round(mv * U.rnd(0.85, 1.15)));
    p.contractYears = ovr(p) >= 62 ? U.rint(0, Math.min(5, Math.max(0, 37 - p.age))) : U.rint(0, 1);
    if (p.contractYears) p.contractNow = true;
  } else if (p.svc >= ARB_YEARS) p.salary = Math.max(MIN_SALARY, Math.round(mv * ARB_PCT[Math.min(3, Math.floor(p.svc) - ARB_YEARS)]));
  else p.salary = Math.round(MIN_SALARY * (1 + PRE_ARB_RAISE * Math.floor(p.svc)));
}
// 最初からいるベテランの功績（それまでの通算は分からないので、年齢と力から推す）
function startMerit(p, age) {
  const M = START_MERIT;
  return Math.round(U.clamp((ovr(p) - M.ovr) / M.ovrSpan, 0, 1) * U.clamp((age - M.age) / M.ageSpan, 0, 1) * M.max * 100) / 100;
}

function newMinorPlayer(tq, opts) {
  const young = U.chance(0.65);
  const age = young ? U.rint(18, 24) : U.rint(24, 31);
  const q = (young ? tq - 12 : tq - 9) + U.gauss() * 5 - Math.max(0, 24 - age) * 2;
  return newPlayer(S, { ...opts, q, age });
}

function signPlayer(team, p) {
  p.teamId = team.id;
  p.no = pickNumber(team, p);
  team.players.push(p.id);
}
// 40 人枠に入れて契約する
function sign40(team, p) { signPlayer(team, p); add40(p); }
function add40(p) { p.on40 = true; p.salary = Math.max(MIN_SALARY, p.salary || 0); }
// 40 人枠から外す（マイナー契約にする）。複数年契約の途中なら、年俸はそのまま払う
function drop40(p) {
  p.on40 = false; delete p.il60;
  if (!underContract(p)) p.salary = MINOR_PAY;
  const t = S.teams[p.teamId];
  if (t) { t.active = t.active.filter(id => id !== p.id); p.lvl = p.lvl || '3A'; }
}

// 背番号：前の番号が空いていればそのまま、なければ好まれる番号から（永久欠番は使わない）
function pickNumber(t, p) {
  const used = new Set([...teamPlayers(t).filter(x => x && x.id !== p.id).map(x => x.no), ...(t.retiredNos || []).map(r => r.no)]);
  if (p.no != null && !used.has(p.no)) return p.no;
  const pool = NO_POOL[p.isP ? 'P' : p.pos === '捕' ? 'C' : 'B'].filter(n => !used.has(n));
  if (pool.length) return U.pick(pool.slice(0, 4));
  for (let n = 0; n < 100; n++) if (!used.has(n)) return n;
  return null;
}

function retireNumber(t, no, name) {
  if (!t.retiredNos) t.retiredNos = [];
  if (t.retiredNos.some(r => r.no === no)) return;
  t.retiredNos.push({ no, name, year: S.year });
  t.retiredNos.sort((a, b) => a.no - b.no);
  t.pop = U.clamp(t.pop + RETIRE_NO_POP, 0, 100);
  addNews(`${t.short}が${name}の背番号${no}を永久欠番にしました。`, t.id === S.myTeamId ? 'good' : '');
}

function removeFromTeam(p) {
  const t = S.teams[p.teamId];
  if (!t) return;
  t.players = t.players.filter(id => id !== p.id);
  t.lineup = t.lineup.filter(s => s.pid !== p.id);
  t.rotation = t.rotation.filter(id => id !== p.id);
  if (t.closer === p.id) t.closer = null;
  if (t.setup === p.id) t.setup = null;
  t.active = (t.active || []).filter(id => id !== p.id);
  p.teamId = null;
  p.on40 = false; delete p.il60; delete p.lvl; delete p.r5;
  endPlayerGoods(t, p);
}

// ---------- 26 人枠・40 人枠・マイナー（人の言葉 2026-11-20 案4「この案で決める」） ----------
function isActive(t, p) { return t.active.includes(p.id); }
function activePlayers(t) { return t.active.map(id => S.players[id]).filter(Boolean); }
function curMonth() { const e = S.schedule[Math.min(S.day, S.schedule.length - 1)]; return S.phase === 'season' && e ? e.m : 3; }
function activeMax() { return curMonth() >= 9 ? ACTIVE_MAX_SEPT : ACTIVE_MAX; }
function pMax() { return curMonth() >= 9 ? P_MAX_SEPT : P_MAX; }
// 40 人枠に数える選手（60 日の負傷者リストの選手は数えない）
function fortyOf(t) { return teamPlayers(t).filter(p => p.on40 && !p.il60); }
function count40(t) { return fortyOf(t).length; }
function minorsOf(t) { return teamPlayers(t).filter(p => !p.on40); }
function rereg(p) { return p.isP ? REREGISTER.P : REREGISTER.B; }

// マイナーに下ろしてから 10 日（投手は 15 日）は戻せない（シーズン中だけの決まり）
function daysUntilEligible(p) {
  if (S.phase !== 'season' || p.downDay == null) return 0;
  return Math.max(0, p.downDay + rereg(p) - S.day);
}
// オプション：40 人枠の選手をマイナーに下ろせるのは 3 シーズンまで（同じシーズンなら何度でも）
function canOption(p) { return p.optYear === S.year || (p.opt || 0) < OPTION_YEARS; }
function optionsLeft(p) { return Math.max(0, OPTION_YEARS - (p.opt || 0)); }
function useOption(p) { if (p.optYear === S.year) return; p.opt = (p.opt || 0) + 1; p.optYear = S.year; }

// 26 人枠に上げられないときは理由を返す
function cannotPromote(t, p) {
  if (isActive(t, p)) return '26人枠にいます';
  if (p.inj) return '故障中';
  if (t.active.length >= activeMax()) return '26人枠が満員';
  if (p.isP && !p.twoWay && activePlayers(t).filter(x => x.isP && !x.twoWay).length >= pMax()) return `投手は${pMax()}人まで`;
  const d = daysUntilEligible(p);
  if (d > 0) return `再登録まであと${d}日`;
  if (!p.on40 && count40(t) >= FORTY_MAX) return '40人枠が満員';
  return null;
}

function promote(t, p) {
  if (!p.on40) add40(p);
  if (!t.active.includes(p.id)) t.active.push(p.id);
  delete p.il;
}

// 26 人枠から外してマイナーへ。ケガでなければオプションを使う
function demote(t, p) {
  if (p.r5 && p.r5.to === t.id && S.phase === 'season' && !p.inj) { r5Return(p); return; } // ルール 5 の選手は、26 人枠から外すと元の球団に返す
  t.active = t.active.filter(id => id !== p.id);
  if (S.phase === 'season') {
    p.downDay = S.day;
    if (!p.inj && p.on40) useOption(p);
  }
  p.lvl = p.lvl || '3A';
}

// 26 人枠をおまかせで選ぶ（40 人枠の中から）：投手 13 人（先発 5 ＋ リリーフ 8）、野手 13 人（捕手は 2 人以上）
function autoActive(t) {
  const max = activeMax(), pm = pMax();
  const all = fortyOf(t).filter(p => !p.inj && (isActive(t, p) || daysUntilEligible(p) === 0));
  const chosen = [];
  let nP = 0;
  const take = p => {
    if (chosen.includes(p) || chosen.length >= max) return false;
    if (p.isP && !p.twoWay) { if (nP >= pm) return false; nP++; }
    chosen.push(p);
    return true;
  };
  const takeN = (list, n) => { let k = 0; for (const p of list) { if (k >= n) break; if (take(p)) k++; } };
  // ルール 5 で取った選手は、まる 1 年 26 人枠に置く決まり。力のある二刀流も先に入れる
  all.filter(p => p.r5 && p.r5.to === t.id).forEach(take);
  takeN(all.filter(p => p.twoWay && ovr(p) >= 55).sort((a, b) => ovr(b) - ovr(a)), 2);
  const pit = all.filter(p => p.isP);
  takeN(pit.slice().sort((a, b) => (starterVal(b) + aptOf(b).sp * 6) - (starterVal(a) + aptOf(a).sp * 6)), ROTATION_SIZE);
  takeN(pit.slice().sort((a, b) => (relVal(b) + aptOf(b).rp * 4) - (relVal(a) + aptOf(a).rp * 4)), pm - ROTATION_SIZE);
  const fie = all.filter(p => !p.isP).sort((a, b) => ovr(b) - ovr(a));
  takeN(fie.filter(p => p.pos === '捕'), 2);
  // 守る位置に穴があかないように、遊・二・三・一を守れる人を 1 人ずつ、外野を 3 人は入れる
  [['遊', 1], ['二', 1], ['三', 1], ['一', 1], ['中', 3]].forEach(([pos, n]) => {
    const can = p => posFit(p, pos) >= SUB_FIT;
    const have = chosen.filter(p => canBat(p) && can(p)).length;
    if (have < n) takeN(fie.filter(can), n - have);
  });
  fie.forEach(take);
  all.forEach(take);
  const before = t.active.slice();
  t.active = chosen.map(p => p.id);
  before.forEach(id => {
    const p = S.players[id];
    if (!t.active.includes(id) && p && S.phase === 'season') { p.downDay = S.day; if (!p.inj) useOption(p); p.lvl = p.lvl || '3A'; }
  });
  t.active.forEach(id => { delete S.players[id].lvl; });
}

// 空いている 26 人枠を、上げられる選手で埋める（投手が足りなければ投手から）。40 人枠の中だけ
function fillActive(t) {
  let n = 0;
  while (t.active.length < activeMax()) {
    const act = activePlayers(t);
    const needP = act.filter(p => p.isP).length < pMax();
    const cands = fortyOf(t).filter(p => !cannotPromote(t, p)).sort((a, b) => (b.isP === needP) - (a.isP === needP) || ovr(b) - ovr(a));
    if (!cands.length) break;
    promote(t, cands[0]);
    n++;
  }
  return n;
}

// 試合ができないほど人が足りなければ、40 人枠から（いなければマイナーから 40 人枠に入れて）上げる
function ensureEnoughActive(t) {
  const healthy = isP => activePlayers(t).filter(p => p.isP === isP && !p.inj).length;
  const up = isP => {
    const ok = p => p.isP === isP && !p.inj && !isActive(t, p) && daysUntilEligible(p) === 0;
    let c = fortyOf(t).filter(ok).sort((a, b) => ovr(b) - ovr(a))[0];
    if (!c && count40(t) < FORTY_MAX) c = minorsOf(t).filter(ok).sort((a, b) => ovr(b) - ovr(a))[0];
    if (!c) return false;
    if (t.active.length >= activeMax()) {
      const out = activePlayers(t).filter(p => p.inj).sort((a, b) => a.isP - b.isP)[0];
      if (!out) return false;
      demote(t, out);
    }
    promote(t, c);
    if (t.id === S.myTeamId) addNews(`選手が足りないので${c.name}を26人枠に上げました。`);
    return true;
  };
  while (healthy(false) < 10 && up(false));
  while (healthy(true) < 9 && up(true));
}

// ケガをした 26 人枠の選手は負傷者リストへ。代わりに 40 人枠（いなければマイナー）から同じ種類（投手か野手か）の選手を上げる
function injuryReplace(t, p) {
  if (!t.active || !isActive(t, p)) return;
  demote(t, p);
  p.il = true;
  if (p.inj > IL60_DAYS && p.on40) p.il60 = true; // 60 日の負傷者リストは 40 人枠に数えない
  const ok = x => x.isP === p.isP && !cannotPromote(t, x);
  const sub = fortyOf(t).filter(ok).sort((a, b) => ovr(b) - ovr(a))[0]
    || (t.id !== S.myTeamId || count40(t) < FORTY_MAX ? minorsOf(t).filter(ok).sort((a, b) => ovr(b) - ovr(a))[0] : null);
  if (sub) promote(t, sub);
  if (t.id === S.myTeamId) addNews(`${p.name}を${p.il60 ? '60日の' : ''}負傷者リストに入れました${sub ? `。代わりに${sub.name}を26人枠に上げました` : ''}。`);
}

// マイナーの階層を決める。40 人枠でマイナーにいる選手と、力のある選手から 3A に。keep なら、自分で決めた階層はそのまま
function assignLevels(t, all) {
  const down = teamPlayers(t).filter(p => !isActive(t, p));
  const mine = t.id === S.myTeamId && !all;
  const list = down.filter(p => !(mine && p.lvlSet && p.lvl)).sort((a, b) => (b.on40 - a.on40) || ovr(b) - ovr(a));
  const left = { '3A': LEVEL['3A'].size - down.filter(p => mine && p.lvlSet && p.lvl === '3A').length, '2A': LEVEL['2A'].size - down.filter(p => mine && p.lvlSet && p.lvl === '2A').length };
  list.forEach(p => {
    if (left['3A'] > 0) { p.lvl = '3A'; left['3A']--; } else if (left['2A'] > 0) { p.lvl = '2A'; left['2A']--; } else p.lvl = '1A';
    if (all) delete p.lvlSet;
  });
}
function levelOf(t, p) { return isActive(t, p) ? 'MLB' : p.lvl || '3A'; }

// ほかの球団の 40 人枠の手入れ：マイナーに、40 人枠のいちばん下よりはっきり上の選手がいれば入れ替える
function ai40(t, n = 3) {
  if (t.id === S.myTeamId) return;
  for (let k = 0; k < n; k++) {
    const mins = minorsOf(t).filter(p => !p.inj).sort((a, b) => tradeValue(b) - tradeValue(a));
    const best = mins[0];
    if (!best) return;
    if (count40(t) < FORTY_MAX) { add40(best); continue; }
    const worst = fortyOf(t).filter(p => !isActive(t, p) && !underContract(p) && !p.r5).sort((a, b) => tradeValue(a) - tradeValue(b))[0];
    if (!worst || tradeValue(best) <= tradeValue(worst) * 1.25) return;
    drop40(worst);
    add40(best);
  }
}

// ---------- オーダー ----------
function autoLineup(team) {
  const fs = activePlayers(team).filter(p => canBat(p) && !p.inj);
  const used = new Set();
  const slots = [];
  ['捕', '遊', '二', '中', '三', '右', '左', '一'].forEach(pos => {
    let best = null, bv = -1;
    fs.forEach(p => {
      if (used.has(p)) return;
      const f = posFit(p, pos);
      const v = batVal(p) * 0.6 + (p.a.field * 0.7 + p.a.arm * 0.3) * f * 0.5 + f * 45;
      if (v > bv) { bv = v; best = p; }
    });
    if (best) { used.add(best); slots.push({ p: best, pos }); }
  });
  const dh = fs.filter(p => !used.has(p)).sort((a, b) => batVal(b) - batVal(a))[0];
  if (dh) slots.push({ p: dh, pos: '指' });
  // 野手が 9 人そろわないときは、ケガ人や投手でも埋める
  if (slots.length < 9) {
    const inLine = new Set(slots.map(s => s.p));
    const spare = activePlayers(team).filter(p => !inLine.has(p)).sort((a, b) => (a.isP - b.isP) || (batVal(b) - batVal(a)));
    const free = LPOS.filter(pos => !slots.some(s => s.pos === pos));
    while (slots.length < 9 && spare.length) slots.push({ p: spare.shift(), pos: free.shift() || '指' });
  }
  // 打順：中軸 3 人に長打、1・2 番に足とミート
  slots.sort((a, b) => batVal(b.p) - batVal(a.p));
  const core = slots.slice(0, 3).sort((a, b) => b.p.a.power - a.p.a.power);
  const rest = slots.slice(3);
  const top = rest.slice(0, 3).sort((a, b) => (b.p.a.speed + b.p.a.meet) - (a.p.a.speed + a.p.a.meet));
  const order = [top[0], top[1], core[1], core[0], core[2], top[2], ...rest.slice(3)].filter(Boolean);
  team.lineup = order.map(s => ({ pid: s.p.id, pos: s.pos }));
}

function autoRotation(team) {
  const ps = activePlayers(team).filter(p => canPitch(p) && !p.inj);
  const spv = p => starterVal(p) + aptOf(p).sp * 6;
  const starters = ps.slice().sort((a, b) => spv(b) - spv(a)).slice(0, ROTATION_SIZE);
  team.rotation = starters.map(p => p.id);
  const pen = ps.filter(p => !starters.includes(p)).sort((a, b) => (relVal(b) + aptOf(b).rp * 4) - (relVal(a) + aptOf(a).rp * 4));
  team.closer = pen.length ? pen[0].id : null;
  team.setup = pen.length > 1 ? pen[1].id : null;
  refreshRoles(team);
}

function refreshRoles(team) {
  teamPlayers(team).forEach(p => {
    if (!canPitch(p)) return;
    if (team.rotation.includes(p.id)) p.role = '先発';
    else if (team.closer === p.id) p.role = '抑え';
    else if (team.setup === p.id) p.role = 'セットアッパー';
    else p.role = '中継';
  });
}

// ケガ人や抜けた選手を埋める
function ensureLineup(Sx, team) {
  const isMine = team.id === S.myTeamId;
  ensureEnoughActive(team);
  if (!isMine) { autoLineup(team); }
  const roster = new Set(team.active); // 試合に出られるのは一軍だけ
  if (team.lineup.length !== 9) autoLineup(team);
  team.lineup.forEach(slot => {
    const p = S.players[slot.pid];
    if (p && roster.has(p.id) && !p.inj && canBat(p)) return;
    const inLine = new Set(team.lineup.map(s => s.pid));
    const cands = activePlayers(team).filter(x => canBat(x) && !x.inj && !inLine.has(x.id));
    if (!cands.length) return;
    cands.sort((a, b) => (batVal(b) + posFit(b, slot.pos) * 40) - (batVal(a) + posFit(a, slot.pos) * 40));
    const sub = cands[0];
    if (isMine && p) addNews(`${p.name}に代わって${sub.name}が${slot.pos === '指' ? '指名打者' : slot.pos}に入りました。`);
    slot.pid = sub.id;
  });
  team.rotation = team.rotation.filter(id => roster.has(id));
  if (team.rotation.length < ROTATION_SIZE) {
    const extra = activePlayers(team).filter(p => canPitch(p) && !team.rotation.includes(p.id) && p.id !== team.closer && p.id !== team.setup)
      .sort((a, b) => starterVal(b) - starterVal(a));
    while (team.rotation.length < ROTATION_SIZE && extra.length) team.rotation.push(extra.shift().id);
  }
  if (team.closer != null && !roster.has(team.closer)) team.closer = null;
  if (team.setup != null && !roster.has(team.setup)) team.setup = null;
  refreshRoles(team);
}

function pickStarter(Sx, team) {
  const rot = team.rotation;
  // ふつうは中 5 日以上。だれも空いていなければ中 4 日まで詰める
  for (const need of [STARTER_REST, STARTER_REST - 1]) {
    for (let i = 0; i < rot.length; i++) {
      const idx = (team.rotIdx + i) % rot.length;
      const p = S.players[rot[idx]];
      if (p && !p.inj && p.rest >= need) { team.rotIdx = (idx + 1) % rot.length; return p; }
    }
  }
  // ローテが崩れたら、いちばん休んでいる投手
  const ps = activePlayers(team).filter(p => canPitch(p) && !p.inj && p.id !== team.closer && p.id !== team.setup);
  ps.sort((a, b) => (b.rest * 10 + b.a.stamina) - (a.rest * 10 + a.a.stamina));
  return ps[0] || teamPlayers(team).find(p => p.isP) || teamPlayers(team)[0];
}

// ---------- シーズン ----------
// 開幕は 3 月最後の木曜日（仮・AI）
function openingDay(year) {
  const d = new Date(year, 2, 31);
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
  return d;
}

// カードの一覧（人の言葉 2026-11-20 案2「この案で進めよう」）。地区の中の順番の「ずれ」で、だれと何連戦かを決める
function makeSeries(games) {
  const fmt = SEASON_FORMATS[games] || SEASON_FORMATS[162];
  const list = [];
  const add = (a, b, lens, inter) => lens.forEach((len, i) => {
    const h = (i + a + b + S.year) % 2 === 0; // 同じ相手との 2 つ目のカードは、ホームとビジターを入れ替える
    list.push({ home: h ? a : b, away: h ? b : a, len, ...(inter ? { inter: true } : {}) });
  });
  const T = S.teams, mod = (v, n) => ((v % n) + n) % n;
  for (let a = 0; a < T.length; a++) {
    for (let b = a + 1; b < T.length; b++) {
      if (T[a].lg === T[b].lg) add(a, b, T[a].div === T[b].div ? fmt.div(mod(b - a, 5)) : fmt.other(mod((b % 5) - (a % 5), 5)));
      else {
        const d = mod((b % 15) - (a % 15), 15);
        add(a, b, d === 0 ? fmt.rival : fmt.inter(d), true);
      }
    }
  }
  return list;
}

// 日程を組む：空いている球団どうしで、残りの試合の多い相手から順にカードを入れていく。カードのあとに休みが入ることもある
function makeSchedule(games) {
  const series = U.shuffle(makeSeries(games));
  const n = S.teams.length;
  const rem = Array(n).fill(0);
  series.forEach(s => { rem[s.home] += s.len; rem[s.away] += s.len; });
  const busy = Array(n).fill(0), last = {}, days = [];
  for (let d = 0; series.length && d < 400; d++) {
    const free = U.shuffle(S.teams.map(t => t.id).filter(id => busy[id] <= d)).sort((x, y) => rem[y] - rem[x]);
    const used = new Set();
    free.forEach(t => {
      if (used.has(t)) return;
      let best = -1, bs = -Infinity;
      series.forEach((s, i) => {
        if (s.home !== t && s.away !== t) return;
        const o = s.home === t ? s.away : s.home;
        if (used.has(o) || busy[o] > d) return;
        const sc = rem[o] + Math.random() * 3 - (last[t] === o ? 20 : 0);
        if (sc > bs) { bs = sc; best = i; }
      });
      if (best < 0) return;
      const s = series.splice(best, 1)[0];
      for (let k = 0; k < s.len; k++) (days[d + k] = days[d + k] || []).push({ home: s.home, away: s.away, ...(s.inter ? { inter: true } : {}) });
      [s.home, s.away].forEach(x => { busy[x] = d + s.len + (U.chance(OFF_DAY_CHANCE) ? 1 : 0); rem[x] -= s.len; used.add(x); });
      last[s.home] = s.away; last[s.away] = s.home;
    });
  }
  const sched = [];
  const dt = openingDay(S.year);
  const push = (gs, extra) => { sched.push({ m: dt.getMonth() + 1, d: dt.getDate(), w: dt.getDay(), games: gs, ...extra }); dt.setDate(dt.getDate() + 1); };
  const asAt = Math.round(days.length * AS_AT);
  for (let i = 0; i < days.length; i++) {
    // オールスターの休み：休み・ドラフト会議・オールスター・休み（人の言葉 2026-11-20 案2・案7）
    if (i === asAt) { push([]); push([], { draft: true }); push([], { allstar: 1 }); push([]); }
    push(days[i] || []);
  }
  return sched;
}

// 次に自分のチームの試合がある日
function nextMyGame() {
  for (let i = S.day; i < S.schedule.length; i++) {
    const m = S.schedule[i].games.find(x => x.home === S.myTeamId || x.away === S.myTeamId);
    if (m) return { entry: S.schedule[i], m };
  }
  return null;
}

function startSeason() {
  S.day = 0;
  S.phase = 'season';
  S.schedule = makeSchedule(S.games);
  S.myGames = [];
  S.lastGame = null;
  S.off = null;
  S.post = null;
  S.draft = null;
  S.pbp = []; // ユニバースシリーズの流れは、その年の分だけ残す
  Object.values(S.players).forEach(p => { p.stats = newStats(); p.rest = 7; p.fatigue = 0; p.downDay = null; p.svc0 = p.svc || 0; p.svcDays = 0; delete p.mst; });
  S.draftClass = makeDraftClass();
  announceDraftClass();
  S.watch = [];
  const scale = S.games / 162;
  S.teams.forEach(t => {
    t.w = t.l = t.d = t.rs = t.ra = 0;
    t.rotIdx = 0;
    t.fin = newFin();
    t.goods.forEach(g => { g.season = 0; });
    t.promoUsed = [];
    const M = MARKETS[t.mk];
    const sponsor = Math.round((SPONSOR_BASE + t.pop * SPONSOR_PER_POP) * M.sponsor * scale * incomeMul());
    const tv = Math.round(NATIONAL_TV * scale * incomeMul()); // 全国の放映権は 30 球団で同じ額
    t.money += sponsor + tv; t.fin.sponsor += sponsor; t.fin.tv += tv;
    if (t.id !== S.myTeamId) { aiTrim40(t); ai40(t, 8); autoActive(t); autoLineup(t); autoRotation(t); }
    else {
      trimActive(t);
      const n = fillActive(t);
      if (n) addNews(`26人枠の空きに${n}人を登録しました。`);
    }
    assignLevels(t);
    ensureLineup(S, t);
  });
  addNews(`${S.year}年シーズン開幕！ スポンサー収入 ${U.money(myTeam().fin.sponsor)}・全国の放映権 ${U.money(myTeam().fin.tv)}`, 'big');
}
// 26 人枠が上限を超えていたら（9 月の 28 人のまま年をまたいだときなど）、力の低い順にマイナーへ
function trimActive(t) {
  while (t.active.length > activeMax() || activePlayers(t).filter(p => p.isP && !p.twoWay).length > pMax()) {
    const tooP = activePlayers(t).filter(p => p.isP && !p.twoWay).length > pMax();
    const out = activePlayers(t).filter(p => !tooP || (p.isP && !p.twoWay)).sort((a, b) => ovr(a) - ovr(b))[0];
    if (!out) break;
    t.active = t.active.filter(id => id !== out.id); out.lvl = '3A';
    if (t.id === S.myTeamId) addNews(`26人枠の上限に合わせて、${out.name}をマイナーに下ろしました。`);
  }
}
// ほかの球団の 40 人枠が上限を超えていたら（60 日の負傷者リストから戻ったときなど）、いちばん下を外す
function aiTrim40(t) {
  if (t.id === S.myTeamId) return;
  while (count40(t) > FORTY_MAX) {
    const ws = fortyOf(t).filter(p => !isActive(t, p)).sort((a, b) => underContract(a) - underContract(b) || tradeValue(a) - tradeValue(b));
    if (!ws.length) break;
    drop40(ws[0]);
  }
}
// 自分の球団の人数が決まりに合わないときの理由（合っていれば null）
function rosterProblem(t) {
  if (count40(t) > FORTY_MAX) return `40人枠が${count40(t)}人です（${FORTY_MAX}人まで）。「26人・40人枠」の画面で、だれかを40人枠から外してください。`;
  if (t.active.length > activeMax()) return `26人枠が${t.active.length}人です（${activeMax()}人まで）。`;
  const np = activePlayers(t).filter(p => p.isP && !p.twoWay).length;
  if (np > pMax()) return `26人枠の投手が${np}人です（${pMax()}人まで）。`;
  return null;
}

// 年俸の合計（マイナー契約の選手も入れる）と、ぜいたく税に数える 40 人枠の年俸の合計
function payroll(t) { return U.sum(teamPlayers(t), p => p.salary); }
function payroll40(t) { return U.sum(teamPlayers(t).filter(p => p.on40), p => p.salary); }
function incomeMul() { return (INCOME_LEVELS[S.income] || INCOME_LEVELS.high).mul; }

function capacity(t) { return CAPACITY_BASE + t.fac.stadium * CAPACITY_PER_LV; }
function fillRate(t) { return U.clamp(0.62 + (t.pop - 50) / 250 + MARKETS[t.mk].fill, 0.4, 1); }
// ホーム 1 試合の入場料・飲食・地元の放映権と運営費（市場が大きいほど多い）
function homeGate(t) {
  const M = MARKETS[t.mk];
  const att = Math.round(capacity(t) * U.clamp(fillRate(t) + U.rnd(-0.03, 0.03), 0.4, 1) / 10) * 10;
  const im = incomeMul();
  const gate = att * M.ticket * im, food = att * FOOD_PER_FAN * im, tv = M.tv * im;
  const ops = OPS_PER_GAME + t.fac.stadium * OPS_PER_STADIUM;
  t.money += gate + food + tv - ops;
  t.fin.gate += gate; t.fin.food += food; t.fin.ltv += tv; t.fin.ops += ops;
  return att;
}

function dailyUpdate() {
  Object.values(S.players).forEach(p => {
    if (p.teamId == null) return;
    const t = S.teams[p.teamId];
    p.rest++;
    p.fatigue = Math.max(0, p.fatigue - 3);
    if (p.inj > 0) {
      if (S.phase === 'season') p.stats.injd = (p.stats.injd || 0) + 1; // 今季ケガで休んだ日数（引退を決めるときに見る）
      p.inj -= 1 + (U.chance(t.fac.medical * 0.1) ? 1 : 0);
      if (p.inj <= 0) {
        p.inj = 0;
        const fromIL = p.il;
        delete p.il; delete p.il60;
        if (t.id === S.myTeamId) addNews(`${p.name}がケガから復帰しました。${fromIL ? '負傷者リストから外れ、マイナーで待っています（26人枠に上げられます）。' : ''}`);
      }
    }
    if (U.chance(0.25)) p.cond = U.clamp(p.cond + (U.chance(0.5) ? 1 : -1), 1, 5);
  });
}

function injuryCheck(res) {
  res.sides.forEach(side => {
    const t = side.team;
    const mul = INTENSITY[t.intensity].inj / 0.005 * (1.2 - t.fac.medical * 0.1);
    side.lineup.forEach(sl => {
      const p = sl.p;
      if (p.inj) return;
      if (U.chance(0.0012 * mul * (p.age >= 33 ? 1.5 : 1))) injure(p, U.rint(3, 30));
    });
  });
}

// ケガ。まれに長引く大ケガになる（60 日の負傷者リスト）
function injure(p, days) {
  if (U.chance(BIG_INJ_CHANCE)) days = U.rint(BIG_INJ_DAYS[0], BIG_INJ_DAYS[1]);
  p.inj = days;
  if (p.teamId === S.myTeamId) addNews(`${p.name}が故障しました（全治${days}日）。`, 'bad');
  if (p.teamId != null && S.phase !== 'off') injuryReplace(S.teams[p.teamId], p);
}

// 1 試合をして、入場料・ケガ・グッズ・自分の試合の記録までまとめる
function playOne(m, label, post, pbp) {
  const home = S.teams[m.home], away = S.teams[m.away];
  const myId = S.myTeamId;
  const mine = m.home === myId || m.away === myId;
  const res = post ? playPostGame(home, away, mine, pbp) : playGame(S, home, away, mine);
  if (res.pbp) { if (!S.pbp) S.pbp = []; S.pbp.push({ label, kind: 'ws', ...res.pbp }); }
  if (res.feats.length) recordFeats(res, [away, home], label, res.pbp ? S.pbp.length - 1 : null);
  m.score = res.score;
  const att = homeGate(home);
  if (!post) {
    home.rs += res.score[1]; home.ra += res.score[0];
    away.rs += res.score[0]; away.ra += res.score[1];
    if (res.score[1] > res.score[0]) { home.w++; away.l++; home.pop += 0.07; away.pop -= 0.045; }
    else if (res.score[0] > res.score[1]) { away.w++; home.l++; away.pop += 0.07; home.pop -= 0.045; }
    else { home.d++; away.d++; } // 30 回でも決まらなかったとき（ほとんどない）
  } else {
    const win = res.score[1] > res.score[0] ? home : res.score[0] > res.score[1] ? away : null;
    if (win) win.pop += 0.4;
  }
  home.pop = U.clamp(home.pop, 0, 100); away.pop = U.clamp(away.pop, 0, 100);
  injuryCheck(res);
  if (mine) {
    const meIsHome = m.home === myId;
    sellGoods(myTeam(), meIsHome);
    if (!post) {
      const my = meIsHome ? res.score[1] : res.score[0], op = meIsHome ? res.score[0] : res.score[1];
      const r = my > op ? '勝' : my < op ? '敗' : '分';
      S.myGames.push({ day: label, opp: meIsHome ? m.away : m.home, home: meIsHome, my, op, r, inter: !!m.inter, wp: res.detail.wp, lp: res.detail.lp, sp: res.detail.sp });
    }
    S.lastGame = { label, home: m.home, away: m.away, score: res.score, att, ...res.detail };
  }
  return res;
}

// 達成記録をニュースと記録に残す（ユニバースシリーズは、試合を見るまで隠す）
function featText(f) { return f.k === 'k' ? `1試合${f.n}奪三振` : f.k === 'hr4' && f.n > 4 ? `1試合${f.n}本塁打` : FEAT_WORD[f.k]; }
function recordFeats(res, sides, label, pbi) {
  if (!S.feats) S.feats = [];
  res.feats.forEach(f => {
    const t = sides[f.side], o = sides[1 - f.side];
    const rec = { y: S.year, k: f.k, n: f.n, pids: f.ps.map(p => p.id), name: f.ps.map(p => p.name).join('→'), team: t.short, opp: o.short, label, pbi };
    S.feats.unshift(rec);
    if (f.k !== 'rnh') f.ps.forEach(p => { p.fx = p.fx || {}; p.fx[f.k] = (p.fx[f.k] || 0) + 1; });
    f.ps.forEach(p => addFame(p, FEAT_FAME[f.k] / f.ps.length));
    const mine = t.id === S.myTeamId, theirs = o.id === S.myTeamId;
    const n = addNews(`${label ? `${label} ` : ''}${t.short}の${rec.name}が${o.short}戦で${featText(f)}を達成！`, mine ? 'big' : theirs ? 'bad' : '');
    if (pbi != null) n.hide = pbi;
  });
}

function advanceDay() {
  if (S.phase !== 'season' || S.day >= S.schedule.length) return false;
  if (S.draft && !S.draft.finished) return false; // ドラフト会議が終わるまで先へ進まない
  const entry = S.schedule[S.day];
  if (entry.draft && !S.draft) { draftStart(); return false; }
  dailyUpdate();
  if (entry.allstar) allStarDay(entry.allstar);
  // 9 月からは 26 人枠が 28 人に広がる
  if (entry.m >= 9 && S.septUp !== S.year) {
    S.septUp = S.year;
    S.teams.forEach(t => { const n = fillActive(t); if (t.id === S.myTeamId) addNews(`9月になり、26人枠が${ACTIVE_MAX_SEPT}人に広がりました${n ? `（${n}人を上げました）` : ''}。`); });
  }
  entry.games.forEach(m => playOne(m, dateLabel(entry), false));
  // サービスタイム：26 人枠か負傷者リストにいた日
  S.teams.forEach(t => teamPlayers(t).forEach(p => { if (isActive(t, p) || (p.on40 && p.il)) p.svcDays = (p.svcDays || 0) + 1; }));
  // 年俸と施設の維持費は、毎日少しずつ払う（短いシーズンは、試合数に合わせて少なく）
  const k = S.games / 162 / S.schedule.length;
  S.teams.forEach(t => { const pay = payroll(t) * k; t.money -= pay; t.fin.salary += pay; });
  const my = myTeam(), up = upkeepTotal(my) * k;
  my.money -= up; my.fin.upkeep = (my.fin.upkeep || 0) + up;
  // 月曜に 1 週間分の練習の成果が出る
  if (entry.w === 1) {
    weeklyTraining(); randomEvent(); awakenCheck(1); tradeOfferTick();
    S.teams.forEach(t => { if (t.id !== S.myTeamId) { aiTrim40(t); ai40(t, 2); autoActive(t); autoRotation(t); assignLevels(t); } });
  }
  S.day++;
  if (S.retireYear !== S.year && S.day >= Math.round(S.schedule.length * RETIRE_ANNOUNCE_AT)) announceRetire();
  if (S.day >= S.schedule.length) endRegular();
  return true;
}

// 人気度の下限：功績のある選手は、活躍しない年でもここより下がらない
// 功績の計算は重いので、タイトルが増えたときだけ数え直す（保存はしない）
let fameFloorCache = { key: '', map: {} };
function fameFloor(p) {
  const key = `${S.year}:${(S.awardHist || []).length}`;
  if (fameFloorCache.key !== key) fameFloorCache = { key, map: {} };
  const m = fameFloorCache.map;
  if (m[p.id] == null) m[p.id] = 5 + meritOf(p) * FAME_FLOOR_MERIT;
  return m[p.id];
}

function weeklyTraining() {
  // 人気度は活躍しないと少しずつ下がる（下限まで）
  Object.values(S.players).forEach(p => {
    if (p.fame <= 5) return;
    const fl = fameFloor(p);
    if (p.fame > fl) p.fame -= (p.fame - fl) * FAME_DECAY;
  });
  S.teams.forEach(t => {
    const it = INTENSITY[t.intensity];
    const mult = it.grow * (0.8 + t.fac.train * 0.1);
    teamPlayers(t).forEach(p => {
      if (p.inj) return;
      // マイナーの若手は、階層に合った相手と戦って伸びる。上の階層ほど伸びやすいが、力が足りないと伸びが落ちる（人の言葉 2026-11-20 案4）
      const L = !isActive(t, p) ? LEVEL[p.lvl || '3A'] : null;
      const farm = L && p.age <= 25 ? L.grow * (ovr(p) < L.q - LEVEL_LOW ? LEVEL_LOW_MUL : 1) : 1;
      const dorm = p.age <= 25 ? 1 + (facLv(t, 'dorm') - 1) * DORM_GROW : 1; // 寮
      trainPlayer(p, mult * farm * dorm);
      if (L && S.phase === 'season') minorWeek(p);
      if (U.chance(it.inj * (1.2 - t.fac.medical * 0.1))) injure(p, U.rint(5, 20));
      if (it.cond && U.chance(0.3)) p.cond = U.clamp(p.cond + it.cond, 1, 5);
    });
  });
  if (S.phase === 'season') S.teams.forEach(grumbleCheck);
}

// マイナーの 1 週間の成績（1 打席ずつは計算せず、階層のふつうの力との差で、出番と簡単な成績だけ出す。人の言葉 2026-11-20 案4）。式は仮・AI
function minorWeek(p) {
  const lv = p.lvl || '3A', L = LEVEL[lv];
  const m = p.mst && p.mst.lvl === lv ? p.mst : (p.mst = { lvl: lv, g: 0, ab: 0, h: 0, hr: 0, outs: 0, er: 0, k: 0 });
  const gap = ovr(p) - L.q;
  if (canBat(p) && !(p.isP && !p.twoWay)) {
    const ab = U.rint(14, 22), avg = U.clamp(0.255 + gap * 0.004 + U.gauss() * 0.03, 0.12, 0.42);
    m.g += 6; m.ab += ab; m.h += Math.round(ab * avg);
    if (U.chance(U.clamp(0.25 + (p.a.power - L.q) * 0.02, 0.02, 0.95))) m.hr += U.rint(1, 2);
  }
  if (canPitch(p)) {
    const sp = aptOf(p).sp >= aptOf(p).rp, outs = sp ? U.rint(12, 21) : U.rint(4, 9);
    const era = U.clamp(4.3 - gap * 0.08 + U.gauss() * 1.2, 0.5, 12);
    m.g += sp ? 1 : 3; m.outs += outs; m.er += era * outs / 27; m.k += Math.round(outs * U.clamp(0.3 + gap * 0.006, 0.15, 0.55));
  }
}

// 起用への不満：チームで上位の力があるのに、今季あまり出られていない（ケガで休んだ日は数えない）
function grumbling(t, p) {
  const gp = gamesPlayed(t);
  if (S.phase !== 'season' || gp < GRUMBLE_FROM || p.inj || ovr(p) < 50 || depthAt(t, p) > GRUMBLE_RANK[p.isP ? 'P' : 'B']) return false;
  const s = p.stats, g = Math.max(1, gp - (s.injd || 0) * 0.85);
  const share = canPitch(p) && !(canBat(p) && s.pa > s.outs) ? s.outs / g : s.pa / (g * 3.1);
  return share < GRUMBLE_SHARE;
}
function grumbleCheck(t) {
  teamPlayers(t).forEach(p => {
    if (!grumbling(t, p)) return;
    addLoyalty(p, -GRUMBLE_LOYALTY);
    if (t.id === S.myTeamId && p.grumble !== S.year) {
      p.grumble = S.year;
      addNews(`${p.name}が起用に不満を漏らしているようです（力はあるのに出番が少ない。忠誠心が下がっていきます）。`, 'bad');
    }
  });
}

function randomEvent() {
  if (!U.chance(0.4)) return;
  const t = myTeam();
  const ps = activePlayers(t);
  const roll = U.rint(1, 6);
  if (roll === 1) {
    const m = U.rint(6, 24) * 10;
    t.money += m; t.fin.other += m;
    addNews(`地元企業とスポンサー契約！ ${U.money(m)}の収入。`, 'good');
  } else if (roll === 2) {
    const young = teamPlayers(t).filter(p => p.age <= 27 && !p.inj);
    if (!young.length) return;
    const p = U.pick(young);
    const k = U.pick(pickKeys(p));
    const up = U.rint(3, 7);
    abilSet(p, k, Math.min(abilMax(p, k), abilGet(p, k) + up));
    addNews(`${p.name}が居残り特訓でコツをつかんだ！ ${abilLabel(k)}が${up}上がった。`, 'good');
  } else if (roll === 3) {
    t.pop = U.clamp(t.pop + 3, 0, 100);
    addNews('ファン感謝デーが大盛況！ 人気が上がった。', 'good');
  } else if (roll === 4) {
    const p = U.pick(ps);
    if (!p) return;
    p.cond = 1;
    addNews(`${p.name}が悩んでいる様子…（絶不調）`, 'bad');
  } else if (roll === 5) {
    const p = U.pick(ps);
    if (!p) return;
    p.cond = 5;
    addNews(`${p.name}が絶好調！ 目の色が違う。`, 'good');
  } else {
    const m = 45;
    t.money += m; t.fin.other += m; t.pop = U.clamp(t.pop + 1, 0, 100);
    addNews(`選手が地元テレビに出演。${U.money(m)}の出演料。`);
  }
}

// ---------- 順位・成績 ----------
function pct(t) { const n = t.w + t.l; return n ? t.w / n : 0; }
// 直接対決の勝ち数（その年の日程から数える。その日のうちは使い回す）
let h2hCache = { key: '', m: {} };
function h2hTable() {
  const key = `${S.year}:${S.day}:${S.phase}:${S.post ? S.post.day : 0}`;
  if (h2hCache.key === key) return h2hCache.m;
  const m = {};
  (S.schedule || []).forEach(e => e.games.forEach(g => {
    if (!g.score || g.score[0] === g.score[1]) return;
    const w = g.score[1] > g.score[0] ? g.home : g.away, l = w === g.home ? g.away : g.home;
    m[w] = m[w] || {}; m[w][l] = (m[w][l] || 0) + 1;
  }));
  h2hCache = { key, m };
  return m;
}
function h2h(m, a, b) { return (m[a] && m[a][b]) || 0; }
// 地区の中の相手との勝率
function divPct(m, t) {
  let w = 0, l = 0;
  S.teams.forEach(o => { if (o.id !== t.id && o.lg === t.lg && o.div === t.div) { w += h2h(m, t.id, o.id); l += h2h(m, o.id, t.id); } });
  return w + l ? w / (w + l) : 0;
}
// 並べ方：勝率 → 直接対決 → 地区の中の勝率 → 得失点差（人の言葉 2026-11-20 案3）
function sortTeams(arr) {
  const m = h2hTable();
  return arr.slice().sort((a, b) => pct(b) - pct(a) || (h2h(m, b.id, a.id) - h2h(m, a.id, b.id)) || divPct(m, b) - divPct(m, a) || (b.rs - b.ra) - (a.rs - a.ra));
}
// 順位表（lg だけならリーグ全体、div もあれば地区）
function standings(lg, div) {
  const arr = sortTeams(S.teams.filter(t => (!lg || t.lg === lg) && (!div || t.div === div)));
  const top = arr[0];
  return arr.map(t => ({ t, gb: ((top.w - t.w) + (t.l - top.l)) / 2 }));
}
// 地区の中での順位
function rankOf(teamId) { const t = S.teams[teamId]; return standings(t.lg, t.div).findIndex(r => r.t.id === teamId) + 1; }
// ポストシーズンに出る 6 球団（1〜3 は地区優勝を勝率の順、4〜6 はワイルドカード）
function playoffSeeds(lg) {
  const winners = sortTeams(DIVS.map(dv => standings(lg, dv)[0].t));
  const wc = sortTeams(S.teams.filter(t => t.lg === lg && !winners.includes(t))).slice(0, 3);
  return [...winners, ...wc].map(t => t.id);
}
// ワイルドカード争い：地区優勝していない球団の順位。差は 3 番目との差
function wildcardStand(lg) {
  const winners = DIVS.map(dv => standings(lg, dv)[0].t);
  const arr = sortTeams(S.teams.filter(t => t.lg === lg && !winners.includes(t)));
  const third = arr[2] || arr[arr.length - 1];
  return arr.map((t, i) => ({ t, gb: i < 3 ? 0 : ((third.w - t.w) + (t.l - third.l)) / 2 }));
}

function leagueBatters(lg) { return Object.values(S.players).filter(p => p.teamId != null && canBat(p) && (!lg || S.teams[p.teamId].lg === lg)); }
function leaguePitchers(lg) { return Object.values(S.players).filter(p => p.teamId != null && canPitch(p) && (!lg || S.teams[p.teamId].lg === lg)); }
function ops(s) {
  if (!s.pa) return 0;
  const obp = (s.h + s.bb) / s.pa;
  const tb = s.h + s.d + s.t * 2 + s.hr * 3;
  return obp + (s.ab ? tb / s.ab : 0);
}

// 規定打席は試合数×3.1、規定投球回は試合数×1
function leaders(lg) {
  const gp = Math.max(1, gamesPlayed(S.teams.find(t => !lg || t.lg === lg)));
  const bats = leagueBatters(lg), pits = leaguePitchers(lg);
  const qualB = bats.filter(p => p.stats.pa >= gp * 3.1);
  const qualP = pits.filter(p => p.stats.outs >= gp * 3);
  const top = (arr, f, asc) => arr.slice().sort((a, b) => asc ? f(a) - f(b) : f(b) - f(a)).slice(0, 5);
  return [
    { name: '打率', list: top(qualB, p => p.stats.h / p.stats.ab), fmt: p => U.avg(p.stats.h, p.stats.ab) },
    { name: '本塁打', list: top(bats, p => p.stats.hr), fmt: p => p.stats.hr },
    { name: '打点', list: top(bats, p => p.stats.rbi), fmt: p => p.stats.rbi },
    { name: '盗塁', list: top(bats, p => p.stats.sb), fmt: p => p.stats.sb },
    { name: '防御率', list: top(qualP, p => p.stats.per / p.stats.outs, true), fmt: p => U.era(p.stats.per, p.stats.outs) },
    { name: '勝利', list: top(pits, p => p.stats.w), fmt: p => p.stats.w },
    { name: '奪三振', list: top(pits, p => p.stats.pk), fmt: p => p.stats.pk },
    { name: 'セーブ', list: top(pits, p => p.stats.sv), fmt: p => p.stats.sv },
  ];
}

// ---------- レギュラーシーズン終了〜ポストシーズン ----------
const AWARD_TITLE = { 打率: '首位打者', 本塁打: '本塁打王', 打点: '打点王', 盗塁: '盗塁王', 防御率: '最優秀防御率', 勝利: '最多勝', 奪三振: '最多奪三振', セーブ: '最多セーブ' };
// ポストシーズン（人の言葉 2026-11-20 案3「この案で決める」）。homes：何戦目が上の球団の本拠地か（1 = 上の球団）
const SERIES_RULE = {
  wc:  { name: 'ワイルドカードシリーズ', need: 2, homes: [1, 1, 1] },
  ds:  { name: '地区シリーズ', need: 3, homes: [1, 1, 0, 0, 1] },
  lcs: { name: 'リーグ優勝決定シリーズ', need: 4, homes: [1, 1, 0, 0, 0, 1, 1] },
  ws:  { name: FINAL_NAME, need: 4, homes: [1, 1, 0, 0, 0, 1, 1] },
};
const POST_STAGES = ['wc', 'ds', 'lcs', 'ws'];

// 26 人枠か負傷者リストにいた日数を、メジャーの年数に足す（172 日で 1 年。日程の日数に合わせて割合で数える）
function addServiceTime() {
  const full = S.schedule.length * SVC_DAYS / SEASON_DAYS;
  Object.values(S.players).forEach(p => {
    if (!p.svcDays) return;
    p.svc = (p.svc || 0) + Math.min(1, p.svcDays / full);
    p.svcDays = 0;
  });
}

// 先発で多く投げた投手は先発の、中継ぎで多く投げた投手は中継ぎの適性が上がることがある
function growApt() {
  Object.values(S.players).forEach(p => {
    if (!canPitch(p) || p.teamId == null) return;
    const a = aptOf(p), st = p.stats;
    if (st.gs >= S.games * 0.1 && a.sp < 2 && U.chance(0.35)) a.sp++;
    if (st.pg - st.gs >= S.games * 0.25 && a.rp < 2 && U.chance(0.35)) a.rp++;
    p.apt = a;
  });
}

// ---------- ぜいたく税と収入の分け合い（人の言葉 2026-11-20 案5「この案で決める」） ----------
function luxLine(y) { return LUX_LINE0 + (y - LUX_YEAR0) * LUX_LINE_UP; }
// ぜいたく税の額。years は、今年を入れて何年続けて線を超えたか
function luxTax(t, years) {
  const over = payroll40(t) - luxLine(S.year);
  if (over <= 0) return 0;
  let tax = over * LUX_RATES[Math.min(years, LUX_RATES.length) - 1];
  LUX_SUR.forEach(([at, r]) => { if (over > at) tax += (over - at) * r; });
  return Math.round(tax * S.games / 162);
}
function localIncome(t) { return t.fin.gate + t.fin.food + t.fin.ltv; }
function settleMoney() {
  const each = U.sum(S.teams, t => localIncome(t) * SHARE_RATE) / S.teams.length;
  S.teams.forEach(t => { const v = Math.round(each - localIncome(t) * SHARE_RATE); t.money += v; t.fin.share += v; });
  const line = luxLine(S.year), payers = [];
  S.teams.forEach(t => {
    const over = payroll40(t) - line;
    if (over <= 0) { t.luxYears = 0; return; }
    t.luxYears = (t.luxYears || 0) + 1;
    const tax = luxTax(t, t.luxYears);
    t.money -= tax; t.fin.lux += tax;
    payers.push({ id: t.id, pay: payroll40(t), over, tax, years: t.luxYears });
    if (over > LUX_PICK_OVER) S.pickTrades.push({ year: S.year + 1, kind: 'drop', team: t.id });
  });
  const total = U.sum(payers, x => x.tax), rest = S.teams.filter(t => !payers.some(x => x.id === t.id));
  rest.forEach(t => { const v = Math.round(total / Math.max(1, rest.length)); t.money += v; t.fin.luxIn += v; });
  if (!S.luxHist) S.luxHist = [];
  S.luxHist.unshift({ year: S.year, line, payers, each: rest.length ? Math.round(total / rest.length) : 0 });
  S.luxHist.length = Math.min(S.luxHist.length, 30);
  const me = payers.find(x => x.id === S.myTeamId), my = myTeam();
  addNews(`収入の分け合い：${my.short}は ${my.fin.share >= 0 ? `${U.money(my.fin.share)}を受け取りました` : `${U.money(-my.fin.share)}を出しました`}。`);
  if (me) addNews(`ぜいたく税：年俸の合計が線（${U.money(line)}）を ${U.money(me.over)} 超え、${me.years}年続けて超えたので ${U.money(me.tax)} を払いました。${me.over > LUX_PICK_OVER ? `大きく超えたので、来年のドラフトの最初の指名が${LUX_PICK_DROP}番下がります。` : ''}`, 'bad');
  else if (payers.length) addNews(`ぜいたく税：${payers.length}球団が線を超えました。${my.short}は税の分け前 ${U.money(my.fin.luxIn)} を受け取りました。`);
}

// 選手の貢献の点（MVP・最優秀投手賞・新人王・ベストナインで使う）
function batScoreOf(p) { const s = p.stats; return ops(s) * s.pa * 0.4 + s.hr * 2 + s.sb * 0.5; }
function pitScoreOf(p) { const s = p.stats; return s.w * 8 + s.sv * 3 + s.outs / 3 - s.per * 2 + s.pk * 0.2; }
function mvpScore(p) { return (canBat(p) ? batScoreOf(p) : 0) + (canPitch(p) ? pitScoreOf(p) : 0); }

function endRegular() {
  addServiceTime();
  growApt();
  settleMoney();
  // 過去の順位として残す（地区ごと）
  if (!S.standHist) S.standHist = [];
  const snap = {};
  LEAGUES.forEach(lg => DIVS.forEach(dv => {
    snap[lg + dv] = standings(lg, dv).map(r => ({ id: r.t.id, name: r.t.name, short: r.t.short, color: r.t.color, w: r.t.w, l: r.t.l, d: r.t.d, rs: r.t.rs, ra: r.t.ra, gb: r.gb }));
  }));
  S.standHist.unshift({ year: S.year, games: S.games, div: snap, ws: null });
  S.phase = 'post';
  Object.values(S.players).forEach(p => { if (p.r5 && p.r5.year <= S.year) delete p.r5; }); // ルール 5 の選手は 1 年いたので、もう自由に動かせる
  const awards = [];
  const seeds = {};
  LEAGUES.forEach(lg => {
    seeds[lg] = playoffSeeds(lg);
    DIVS.forEach(dv => { const c = standings(lg, dv)[0].t; c.pop = U.clamp(c.pop + 4, 0, 100); });
    leaders(lg).forEach(c => {
      const p = c.list[0];
      if (p) awards.push({ lg, title: AWARD_TITLE[c.name], pid: p.id, name: p.name, team: S.teams[p.teamId].short, val: c.fmt(p) });
    });
    const all = lgPlayers(lg).filter(p => p.stats.pa >= S.games * 1.5 || p.stats.outs >= S.games * 1.2);
    const pick = (list, f) => list.slice().sort((a, b) => f(b) - f(a))[0];
    const row = (title, p, val) => p && awards.unshift({ lg, title, pid: p.id, name: p.name, team: S.teams[p.teamId].short, val });
    const rook = pick(all.filter(p => (p.svc0 || 0) < 0.5), mvpScore);
    row('新人王', rook, '');
    const ace = pick(all.filter(canPitch), pitScoreOf);
    row('最優秀投手賞', ace, ace ? `${ace.stats.w}勝 防御率${U.era(ace.stats.per, ace.stats.outs)}` : '');
    row('MVP', pick(all, mvpScore), '');
  });
  awards.forEach(a => addFame(S.players[a.pid], a.title === 'MVP' ? 25 : 15));
  const b9 = LEAGUES.flatMap(bestNine), gg = LEAGUES.flatMap(goldenGlove);
  b9.forEach(a => { const p = S.players[a.pid]; p.b9 = (p.b9 || 0) + 1; addFame(p, 5); });
  gg.forEach(a => { const p = S.players[a.pid]; p.gg = (p.gg || 0) + 1; addFame(p, 3); });
  const myB9 = b9.filter(a => S.players[a.pid].teamId === S.myTeamId).map(a => a.name);
  const myGG = gg.filter(a => S.players[a.pid].teamId === S.myTeamId).map(a => a.name);
  if (myB9.length) addNews(`ベストナインに${myB9.join('・')}が選ばれた！`, 'good');
  if (myGG.length) addNews(`名手賞（守備）に${myGG.join('・')}が選ばれた！`, 'good');
  S.awardHist.unshift({ year: S.year, list: awards.map(a => ({ ...a })), b9, gg });
  updateSeasonRecords();
  // シーズン終わりからポストシーズンまで少しあく
  Object.values(S.players).forEach(p => { p.rest += 2; p.fatigue = 0; });
  S.post = { stage: 'wc', series: [], awards, b9, gg, seeds, day: 0, champ: null };
  LEAGUES.forEach(lg => {
    const s = seeds[lg];
    S.post.series.push(newSeries('wc', lg, s[2], s[5]), newSeries('wc', lg, s[3], s[4]));
  });
  const my = myTeam(), inPost = LEAGUES.some(lg => seeds[lg].includes(my.id));
  addNews(`レギュラーシーズン終了！ ${LEAGUES.map(lg => `${LEAGUE_SHORT[lg]}の第1シードは${S.teams[seeds[lg][0]].name}`).join('、')}。${my.short}は${divName(my.lg, my.div)}${rankOf(my.id)}位${inPost ? '、ポストシーズン進出！' : '。'}`, 'big');
}

// ---------- ベストナイン・名手賞 ----------
// 守った位置：シーズン終わりのスタメンの位置（いなければ本来の位置）。左・中・右は外野にまとめる
function seasonPos(p) {
  const t = S.teams[p.teamId], s = t && t.lineup.find(x => x.pid === p.id);
  const pos = s ? s.pos : (p.isP ? p.pos2 : p.pos);
  return ['左', '中', '右'].includes(pos) ? '外' : pos;
}
function lgPlayers(lg) { return S.teams.filter(t => t.lg === lg).flatMap(teamPlayers); }
function awardRow(lg, pos, p, val) { return { lg, pos, pid: p.id, name: p.name, team: S.teams[p.teamId].short, val }; }
const AWARD_POS = ['捕', '一', '二', '三', '遊', '外', '外', '外'];

// ベストナイン：投手と、守った位置ごとにいちばん打った選手（外野は 3 人、指名打者も 1 人）
function bestNine(lg) {
  const all = lgPlayers(lg), out = [];
  const pit = all.filter(p => canPitch(p) && p.stats.outs >= S.games * 1.5).sort((a, b) => pitScoreOf(b) - pitScoreOf(a))[0];
  if (pit) out.push(awardRow(lg, '投', pit, `${pit.stats.w}勝 防御率${U.era(pit.stats.per, pit.stats.outs)}`));
  const bats = all.filter(p => canBat(p) && p.stats.pa >= S.games * 2).sort((a, b) => batScoreOf(b) - batScoreOf(a));
  [...AWARD_POS, '指'].forEach(pos => {
    const p = bats.find(x => seasonPos(x) === pos && !out.some(a => a.pid === x.id));
    if (p) out.push(awardRow(lg, pos, p, `打率${U.avg(p.stats.h, p.stats.ab)} ${p.stats.hr}本`));
  });
  return out;
}

// 名手賞（守備の賞）：守った位置ごとに、守備がいちばんうまいレギュラー（捕手は肩も重く見る）
function goldenGlove(lg) {
  const all = lgPlayers(lg).filter(p => canBat(p) && p.stats.pa >= S.games * 2), out = [];
  const def = (p, pos) => (pos === '捕' ? p.a.field * 0.5 + p.a.arm * 0.5 : p.a.field * 0.8 + p.a.arm * 0.2) * posFit(p, pos === '外' ? '中' : pos);
  AWARD_POS.forEach(pos => {
    const p = all.filter(x => seasonPos(x) === pos && !out.some(a => a.pid === x.id)).sort((a, b) => def(b, pos) - def(a, pos))[0];
    if (p) out.push(awardRow(lg, pos, p, `守備${U.grade(p.a.field)} 肩${U.grade(p.a.arm)}`));
  });
  return out;
}

// ---------- オールスター ----------
// ファン投票（人気度）で守る位置ごとの野手 9 人と、先発・中継ぎ・抑えを 1 人ずつ。残りは監督推薦（成績）。どの球団からも 1 人は選ぶ
function selectAllStars() {
  const sel = {};
  const byFame = (a, b) => b.fame - a.fame;
  const batScore = p => ops(p.stats) * p.stats.pa * 0.4 + p.stats.hr * 2 + p.stats.sb * 0.5;
  const pitScore = p => p.stats.w * 8 + p.stats.sv * 4 + p.stats.outs / 3 - p.stats.per * 2 + p.stats.pk * 0.3;
  LEAGUES.forEach(lg => {
    const teams = S.teams.filter(t => t.lg === lg);
    const gp = Math.max(1, ...teams.map(gamesPlayed));
    const all = lgPlayers(lg).filter(p => !p.inj);
    const out = [];
    const has = p => out.some(x => x.pid === p.id);
    const add = (p, pos, fan, P) => { out.push({ pid: p.id, name: p.name, team: S.teams[p.teamId].short, pos, fan, P }); };
    const bats = all.filter(p => canBat(p) && p.stats.pa >= gp * 1.5);
    const pits = all.filter(p => p.isP && p.stats.pg >= 5);
    [...AWARD_POS, '指'].forEach(pos => {
      const p = bats.filter(x => !has(x) && seasonPos(x) === pos).sort(byFame)[0] || (pos === '指' && bats.filter(x => !has(x)).sort(byFame)[0]);
      if (p) add(p, pos, true, false);
    });
    [['先', ['先発']], ['中', ['中継', 'セットアッパー']], ['抑', ['抑え']]].forEach(([pos, roles]) => {
      const p = pits.filter(x => !has(x) && roles.includes(x.role)).sort(byFame)[0];
      if (p) add(p, pos, true, true);
    });
    const nBat = () => out.filter(x => !x.P).length, nPit = () => out.filter(x => x.P).length;
    const pitPos = p => (p.role === '先発' ? '先' : p.role === '抑え' ? '抑' : '中');
    if (out.filter(x => x.pos === '捕').length < 2) {
      const c = bats.filter(x => !has(x) && seasonPos(x) === '捕').sort((a, b) => batScore(b) - batScore(a))[0];
      if (c) add(c, '捕', false, false);
    }
    bats.filter(x => !has(x)).sort((a, b) => batScore(b) - batScore(a)).forEach(p => { if (nBat() < AS_BAT) add(p, seasonPos(p), false, false); });
    pits.filter(x => !has(x)).sort((a, b) => pitScore(b) - pitScore(a)).forEach(p => { if (nPit() < AS_PIT) add(p, pitPos(p), false, true); });
    teams.forEach(t => {
      if (out.some(x => S.players[x.pid].teamId === t.id)) return;
      const p = teamPlayers(t).filter(x => !x.inj && (bats.includes(x) || pits.includes(x))).sort((a, b) => ovr(b) - ovr(a))[0];
      if (p) add(p, p.isP ? pitPos(p) : seasonPos(p), false, p.isP);
    });
    out.forEach(x => { const p = S.players[x.pid]; p.as = (p.as || 0) + 1; addFame(p, x.fan ? AS_FAME.fan : AS_FAME.pick); });
    sel[lg] = out;
  });
  S.allStar = { year: S.year, sel, games: [], pts: {} };
  const list = LEAGUES.flatMap(lg => sel[lg]);
  const mine = list.filter(x => S.players[x.pid].teamId === S.myTeamId);
  const top = list.filter(x => x.fan).map(x => S.players[x.pid]).sort((a, b) => b.fame - a.fame)[0];
  addNews(`オールスターの出場選手が決まりました。${top ? `ファン投票の最多得票は${top.name}（${S.teams[top.teamId].short}）。` : ''}`, 'big');
  if (mine.length) addNews(`わがチームからは${mine.map(x => `${x.name}${x.fan ? '（ファン投票）' : ''}`).join('・')}がオールスターに選ばれました！`, 'good');
}

// オールスター用の選抜チーム（その場かぎり。保存しない）
function asTeam(lg, n) {
  const ent = S.allStar.sel[lg].filter(x => S.players[x.pid] && !S.players[x.pid].inj);
  const ps = ent.map(x => S.players[x.pid]);
  const pit = ent.filter(x => x.P).map(x => S.players[x.pid]);
  const rot = pit.filter(p => p.role === '先発').sort((a, b) => starterVal(b) - starterVal(a)).slice(0, 3);
  const pen = pit.filter(p => !rot.includes(p)).sort((a, b) => relVal(b) - relVal(a));
  return {
    id: lg === 'ナ' ? -1 : -2, lg, name: `全${LEAGUE_SHORT[lg]}`, short: `全${LEAGUE_SHORT[lg]}`, color: '#555', fac: {},
    players: ps.map(p => p.id), active: ps.map(p => p.id), lineup: [], rotation: rot.map(p => p.id), rotIdx: n - 1,
    closer: pen[0] ? pen[0].id : null, setup: pen[1] ? pen[1].id : null,
  };
}

function allStarDay(n) {
  if (n === 1) selectAllStars();
  const A = S.allStar;
  if (!A || A.year !== S.year || A.games.length >= n) return;
  const [hl, al] = (S.year + n) % 2 ? ['ナ', 'エ'] : ['エ', 'ナ'];
  const home = asTeam(hl, n), away = asTeam(al, n);
  // 成績・疲れ・役割はシーズンのものに入れない（試合のあとで元に戻す）
  const ps = [...home.players, ...away.players].map(id => S.players[id]);
  const saved = ps.map(p => ({ stats: p.stats, rest: p.rest, fatigue: p.fatigue, role: p.role }));
  ps.forEach(p => { p.stats = newStats(); p.rest = 7; p.fatigue = 0; });
  const res = playGame(S, home, away, false);
  // 活躍した選手に点を付けて MVP を決める（勝ったほうに少し足す）
  const won = res.score[1] > res.score[0] ? 1 : res.score[0] > res.score[1] ? 0 : -1;
  let best = null, bv = 0;
  const score = (p, v, bonus) => {
    if (v <= 0) return;
    A.pts[p.id] = (A.pts[p.id] || 0) + v + bonus;
    if (v + bonus > bv) { bv = v + bonus; best = p; }
  };
  res.sides.forEach((s, i) => {
    const bonus = i === won ? 3 : 0;
    s.lineup.forEach(sl => { const b = sl.box; score(sl.p, b.hr * 4 + b.h * 2 + b.rbi * 1.5 + b.sb, bonus); });
    s.used.forEach(r => score(r.p, r.outs * 0.4 + r.k * 0.6 - r.r * 2, bonus));
  });
  ps.forEach((p, i) => Object.assign(p, saved[i]));
  A.games.push({ home: hl, score: res.score, star: best ? best.name : null });
  addNews(`オールスター：全${LEAGUE_SHORT[al]} ${res.score[0]} - ${res.score[1]} 全${LEAGUE_SHORT[hl]}`, 'big');
  if (n === 1) { // オールスターは 1 試合（人の言葉 2026-11-20 案2）
    const id = Object.keys(A.pts).sort((a, b) => A.pts[b] - A.pts[a])[0];
    const p = id && S.players[id];
    if (p) {
      addFame(p, AS_FAME.mvp);
      p.asMvp = (p.asMvp || 0) + 1;
      A.mvp = { pid: p.id, name: p.name, team: S.teams[p.teamId].short };
      addNews(`オールスターの MVP は${p.name}（${S.teams[p.teamId].short}）！`, p.teamId === S.myTeamId ? 'good' : '');
    }
    delete A.pts;
    if (!S.asHist) S.asHist = [];
    S.asHist.unshift({ y: S.year, g: A.games.map(g => [g.home, ...g.score]), mvp: A.mvp ? [A.mvp.name, A.mvp.team] : null });
  }
}

function newSeries(stage, lg, top, low) {
  return { stage, lg, top, low, wTop: 0, wLow: 0, games: [], done: false, winner: null };
}

function seriesLabel(s) {
  return SERIES_RULE[s.stage].name + (s.stage === 'ws' ? '' : `（${LEAGUE_SHORT[s.lg]}）`);
}

// ポストシーズンの成績はレギュラーシーズンの成績に入れない
function playPostGame(home, away, wantLog, wantPbp) {
  const ps = [...home.players, ...away.players].map(id => S.players[id]);
  const saved = ps.map(p => p.stats);
  ps.forEach(p => { p.stats = newStats(); });
  const res = playGame(S, home, away, wantLog, wantPbp);
  ps.forEach((p, i) => { p.stats = saved[i]; });
  return res;
}

function advancePost() {
  if (S.phase !== 'post') return false;
  const P = S.post;
  dailyUpdate();
  P.series.filter(s => s.stage === P.stage && !s.done).forEach(s => {
    const rule = SERIES_RULE[s.stage];
    const gi = s.games.length;
    const topHome = rule.homes[gi] !== 0;
    const m = topHome ? { home: s.top, away: s.low } : { home: s.low, away: s.top };
    const res = playOne(m, `${seriesLabel(s)} 第${gi + 1}戦`, true, s.stage === 'ws');
    const topScore = m.home === s.top ? res.score[1] : res.score[0];
    const lowScore = m.home === s.top ? res.score[0] : res.score[1];
    if (lowScore > topScore) s.wLow++; else s.wTop++; // 30 回でも決まらなかったときは上の球団の勝ち（ほとんどない）
    s.games.push({ home: m.home, away: m.away, score: res.score, ...(res.pbp ? { pbi: S.pbp.length - 1 } : {}) });
    if (s.wTop >= rule.need) finishSeries(s, s.top);
    else if (s.wLow >= rule.need) finishSeries(s, s.low);
  });
  P.day++;
  if (P.series.filter(s => s.stage === P.stage).every(s => s.done)) nextStage();
  return true;
}

function finishSeries(s, winner) {
  s.done = true;
  s.winner = winner;
  const w = S.teams[winner], l = S.teams[winner === s.top ? s.low : s.top];
  const mine = winner === S.myTeamId || l.id === S.myTeamId;
  const upset = s.top !== winner ? '・下位からの勝ち上がり' : '';
  const n = addNews(`${seriesLabel(s)}：${w.name}が${l.short}を破りました（${Math.max(s.wTop, s.wLow)}勝${Math.min(s.wTop, s.wLow)}敗${upset}）`, mine ? (winner === S.myTeamId ? 'good' : 'bad') : '');
  const g = s.games[s.games.length - 1];
  if (g && g.pbi != null) n.hide = g.pbi;
}

function nextStage() {
  const P = S.post;
  const win = (stage, lg, top) => P.series.find(x => x.stage === stage && x.lg === lg && (top == null || x.top === top)).winner;
  if (P.stage === 'wc') {
    P.stage = 'ds';
    LEAGUES.forEach(lg => {
      const s = P.seeds[lg];
      P.series.push(newSeries('ds', lg, s[0], win('wc', lg, s[3])), newSeries('ds', lg, s[1], win('wc', lg, s[2])));
    });
  } else if (P.stage === 'ds') {
    P.stage = 'lcs';
    LEAGUES.forEach(lg => {
      const s = P.seeds[lg];
      const ws = P.series.filter(x => x.stage === 'ds' && x.lg === lg).map(x => x.winner).sort((a, b) => s.indexOf(a) - s.indexOf(b));
      P.series.push(newSeries('lcs', lg, ws[0], ws[1]));
    });
  } else if (P.stage === 'lcs') {
    P.stage = 'ws';
    const a = S.teams[win('lcs', 'ナ')], b = S.teams[win('lcs', 'エ')];
    // 勝率の高い球団が先に本拠地（同じなら年ごとに入れ替わる）
    const [top, low] = pct(a) > pct(b) || (pct(a) === pct(b) && S.year % 2) ? [a, b] : [b, a];
    P.series.push(newSeries('ws', null, top.id, low.id));
  } else {
    endPost(P.series.find(s => s.stage === 'ws').winner);
  }
}

function endPost(champId) {
  const P = S.post;
  P.champ = champId;
  const my = myTeam();
  const rank = rankOf(my.id);
  const champ = S.teams[champId];
  champ.pop = U.clamp(champ.pop + 10, 0, 100);
  const pennant = Object.fromEntries(LEAGUES.map(lg => [lg, P.series.find(s => s.stage === 'lcs' && s.lg === lg).winner]));
  LEAGUES.forEach(lg => { const t = S.teams[pennant[lg]]; t.pop = U.clamp(t.pop + 4, 0, 100); });
  // 自分のチームの勝ち上がり
  const reached = P.series.filter(s => s.top === my.id || s.low === my.id);
  const last = reached[reached.length - 1];
  let post = '';
  if (champId === my.id) post = `${FINAL_NAME}優勝`;
  else if (last) post = `${SERIES_RULE[last.stage].name}敗退`;
  let prize = 0;
  if (rank === 1) prize += PRIZE.div;
  if (pennant[my.lg] === my.id) prize += PRIZE.pennant;
  if (champId === my.id) prize += PRIZE.champ;
  if (prize) { my.money += prize; my.fin.other += prize; }
  S.history.unshift({ year: S.year, lg: my.lg, lgChamp: S.teams[pennant[my.lg]].name, ws: champ.name, rank, div: my.div, post, w: my.w, l: my.l, d: my.d });
  const last1 = P.series.find(s => s.stage === 'ws').games.slice(-1)[0];
  const n = addNews(`${FINAL_NAME}を制したのは${champ.name}！`, 'big');
  if (last1 && last1.pbi != null) n.hide = last1.pbi;
  if (S.standHist && S.standHist[0] && S.standHist[0].year === S.year) S.standHist[0].ws = champ.name;
  // 成績を年度別に残す（FA で球団が変わる前に）
  Object.values(S.players).forEach(p => {
    if (p.teamId == null) return;
    if (p.stats.g || p.stats.pg) {
      milestoneNews(p);
      p.career.push({ y: S.year, t: S.teams[p.teamId].short, s: { ...p.stats } });
    }
  });
  // 来年のドラフトの順番（ロッタリー）
  const playoff = LEAGUES.flatMap(lg => P.seeds[lg]);
  const worstFirst = sortTeams(S.teams).reverse().map(t => t.id);
  S.draftNext = makeDraftOrder(worstFirst, playoff, S.year + 1);
  const lot = S.draftNext.lottery.find(x => x.id === my.id);
  addNews(`来年のドラフトのロッタリー：1番は${S.teams[S.draftNext.lottery[0].id].short}。${lot ? `${my.short}は${lot.to}番を引きました（成績の順では${lot.from}番目）。` : ''}`, lot && lot.to < lot.from ? 'good' : '');
  S.phase = 'off';
  S.off = { step: 'awards', awards: P.awards, b9: P.b9 || [], gg: P.gg || [], prize, rank, champ: champ.name, post, contract: null };
}

// 来年のドラフトの順番（人の言葉 2026-11-20 案7）。プレーオフに出なかった球団（成績の悪い順）の上から 6 番目までをくじで決め、残りは成績の悪い順
function makeDraftOrder(worstFirst, playoff, year) {
  const non = worstFirst.filter(id => !playoff.includes(id)), po = worstFirst.filter(id => playoff.includes(id));
  const pool = non.map((id, i) => ({ id, w: LOTTERY_W[i] || 0.2 }));
  const top = [];
  for (let k = 0; k < LOTTERY_N && pool.length; k++) {
    const id = U.pickW(pool.map(x => [x.id, x.w]));
    top.push(id);
    pool.splice(pool.findIndex(x => x.id === id), 1);
  }
  return { year: year || S.year, order: [...top, ...pool.map(x => x.id), ...po], lottery: top.map((id, i) => ({ id, from: non.indexOf(id) + 1, to: i + 1 })) };
}

// ---------- 記録・歴史・殿堂入り ----------
// 大きな節目（162 試合のとき）。短いシーズンでは試合数に合わせて小さくする（数は仮・AI）
const MILESTONES = [
  { k: 'h', n: 3000, label: '通算3000安打' }, { k: 'hr', n: 500, label: '通算500本塁打' },
  { k: 'w', n: 300, label: '通算300勝' }, { k: 'sv', n: 400, label: '通算400セーブ' },
];
const byGames = n => Math.max(5, Math.round(n * S.games / 162));
const CAREER_KEYS = ['g', 'pa', 'ab', 'h', 'd', 't', 'hr', 'rbi', 'r', 'sb', 'bb', 'k', 'pg', 'gs', 'w', 'l', 'sv', 'outs', 'ph', 'phr', 'pbb', 'pk', 'per'];

// 通算成績（今季の分も入れる。シーズン後に career に入った年は二重に数えない）
function careerTotal(p) {
  const t = {};
  CAREER_KEYS.forEach(k => { t[k] = 0; });
  const rows = (p.career || []).slice();
  if (p.stats && !rows.some(c => c.y === S.year)) rows.push({ s: p.stats });
  rows.forEach(c => CAREER_KEYS.forEach(k => { t[k] += c.s[k] || 0; }));
  return t;
}

function titlesOf(pid) {
  const out = [];
  (S.awardHist || []).forEach(y => y.list.forEach(a => { if (a.pid === pid) out.push({ year: y.year, title: a.title, lg: a.lg }); }));
  // 整理で年表から消したタイトルは、選手のほうに移してある
  const p = S.players[pid];
  if (p && p.oldTitles) out.push(...p.oldTitles);
  return out;
}

// ---------- 古い年の記録の整理（人が選んだときだけ消す） ----------
// 順位表は「球団・勝敗・差」だけにし、タイトル（MVP も）・ベストナイン・ゴールデングラブの一覧を消す。
// 優勝・球団の記録・シーズン記録・通算記録・殿堂入りは変わらない
function slimHistory(untilYear, lgs) {
  S.awardHist.forEach(y => {
    if (y.year > untilYear) return;
    y.list = y.list.filter(a => {
      if (!lgs.includes(a.lg)) return true;
      // まだいる選手のタイトルは、選手の詳細と殿堂入りの点に使うので、選手に移しておく
      const p = S.players[a.pid];
      if (p) (p.oldTitles = p.oldTitles || []).push({ year: y.year, title: a.title, lg: a.lg });
      return false;
    });
    ['b9', 'gg'].forEach(k => { if (y[k]) y[k] = y[k].filter(a => !lgs.includes(a.lg)); });
    y.slim = [...new Set([...(y.slim || []), ...lgs])];
  });
  S.standHist.forEach(y => {
    if (y.year > untilYear) return;
    Object.keys(y.div || {}).forEach(k => { if (lgs.includes(k[0])) y.div[k] = y.div[k].map(r => ({ id: r.id, w: r.w, l: r.l, d: r.d, gb: r.gb })); });
    y.slim = [...new Set([...(y.slim || []), ...lgs])];
  });
}

// 整理して減るおおよその文字数（ためしに写しで整理してみる）
function slimSaving(untilYear, lgs) {
  const keep = S;
  const before = JSON.stringify(S.awardHist).length + JSON.stringify(S.standHist).length;
  S = { ...keep, awardHist: JSON.parse(JSON.stringify(keep.awardHist)), standHist: JSON.parse(JSON.stringify(keep.standHist)), players: {} };
  try {
    slimHistory(untilYear, lgs);
    return before - JSON.stringify(S.awardHist).length - JSON.stringify(S.standHist).length;
  } finally { S = keep; }
}

// 整理した順位表の行に、球団の名前と色を足して、ふつうの行と同じに扱えるようにする
function histRow(r) {
  if (!r) return r;
  const t = S.teams[r.id];
  return { name: t.name, short: t.short, color: t.color, rs: null, ra: null, ...r };
}

// シーズン記録（歴代トップ 10）。率は規定に届いた選手だけ
const SEASON_REC = [
  { k: 'avg', name: '打率', bat: true, qual: true, f: s => s.h / s.ab },
  { k: 'hr', name: '本塁打', bat: true, f: s => s.hr }, { k: 'rbi', name: '打点', bat: true, f: s => s.rbi },
  { k: 'h', name: '安打', bat: true, f: s => s.h }, { k: 'sb', name: '盗塁', bat: true, f: s => s.sb },
  { k: 'ops', name: 'OPS', bat: true, qual: true, f: s => ops(s) },
  { k: 'w', name: '勝利', f: s => s.w }, { k: 'era', name: '防御率', qual: true, asc: true, f: s => s.per * 27 / s.outs },
  { k: 'sv', name: 'セーブ', f: s => s.sv }, { k: 'pk', name: '奪三振', f: s => s.pk },
];
const REC_TOP = 10;
const CAREER_REC = [
  ['h', '安打'], ['hr', '本塁打'], ['rbi', '打点'], ['sb', '盗塁'], ['g', '出場試合'],
  ['w', '勝利'], ['sv', 'セーブ'], ['pk', '奪三振'], ['pg', '登板'],
];
// ★のない引退選手を残す人数（セーブが増え続けないように）。殿堂入りの選手も★を外すとここに入る
const RETIRED_KEEP = 100;
function updateSeasonRecords() {
  const ps = Object.values(S.players).filter(p => p.teamId != null);
  SEASON_REC.forEach(r => {
    const list = ps.filter(p => (r.bat ? canBat(p) && p.stats.pa > 0 : canPitch(p) && p.stats.pg > 0))
      .filter(p => !r.qual || (r.bat ? p.stats.pa >= S.games * 3.1 : p.stats.outs >= S.games * 3))
      .map(p => ({ v: r.f(p.stats), pid: p.id, name: p.name, team: S.teams[p.teamId].short, year: S.year, games: S.games }));
    const all = (S.records.season[r.k] || []).concat(list).filter(x => isFinite(x.v));
    all.sort((a, b) => (r.asc ? a.v - b.v : b.v - a.v));
    const before = (S.records.season[r.k] || []).slice(0, 1)[0];
    S.records.season[r.k] = all.slice(0, REC_TOP);
    const top = S.records.season[r.k][0];
    // 1 年目は何でも記録になるので知らせない
    if (before && top && top.year === S.year) {
      addNews(`歴代記録！${top.team}の${top.name}がシーズン${r.name}の記録を塗り替えました。`, 'big');
    }
  });
}

// 今季で節目の記録に届いたら知らせる（career に今季を入れる前に呼ぶ）
function milestoneNews(p) {
  const after = careerTotal(p);
  MILESTONES.forEach(m => {
    const need = byGames(m.n);
    if (after[m.k] >= need && after[m.k] - (p.stats[m.k] || 0) < need) {
      addNews(`${S.teams[p.teamId].short}の${p.name}が${m.label}を達成しました！`, p.teamId === S.myTeamId ? 'good' : 'big');
    }
  });
}

function draftLabel(p) { return p.drafted ? `${p.drafted.year}年ドラフト${p.drafted.round}位（${p.drafted.team}）` : ''; }

// 引退するときに、名を残す選手の記録をとっておく（選手そのものは消える）
// 殿堂入りの点：いちばん節目に近い記録（節目で 1）に、MVP とタイトルの数を足す。25 年で 40 人ほど（年に 1〜2 人）になるように測った
function meritPts(c, titles) {
  const mvp = titles.filter(t => t.title === 'MVP').length;
  return Math.max(c.h / byGames(2000), c.hr / byGames(400), c.w / byGames(200), c.sv / byGames(250), c.pk / byGames(2500))
    + mvp * 0.15 + (titles.length - mvp) * 0.05;
}
// 功績（0〜1。1 で殿堂入りくらい）
function meritOf(p) { return U.clamp((p.meritBase || 0) + meritPts(careerTotal(p), titlesOf(p.id)) + (p.b9 || 0) * 0.04 + (p.gg || 0) * 0.02 + (p.as || 0) * 0.01 + (p.jp || 0) * 0.01, 0, 1); }

function retireRecord(p) {
  if (!S.retired) S.retired = [];
  const c = careerTotal(p);
  const titles = titlesOf(p.id);
  const ms = MILESTONES.filter(m => c[m.k] >= byGames(m.n)).map(m => m.label);
  const pts = meritPts(c, titles);
  const hof = ms.length > 0 || pts >= 1;
  const notable = hof || titles.length > 0 || pts >= 0.6;
  if (!notable) return;
  const years = (p.career || []).map(x => x.y);
  const teams = [...new Set((p.career || []).map(x => x.t))];
  const keep = {};
  ['g', 'pa', 'ab', 'h', 'hr', 'rbi', 'sb', 'pg', 'w', 'l', 'sv', 'outs', 'per', 'pk'].forEach(k => { keep[k] = c[k]; });
  S.retired.unshift({
    id: p.id, name: p.name, pos: canPitch(p) && !p.twoWay ? '投' : p.twoWay ? '二刀流' : p.pos, isP: canPitch(p), bat: canBat(p),
    from: years.length ? Math.min(...years) : S.year, to: S.year, teams, age: p.age, c: keep,
    titles: titles.map(t => `${t.year} ${t.title}`), ms, hof, hofYear: hof ? S.year : null, draft: draftLabel(p),
    star: hof, // 殿堂入りの選手には、はじめから星を付けておく（外せる）
    my: teams.includes(myTeam().short),
  });
  if (hof) addNews(`${p.name}（${teams.join('→')}）が引退し、殿堂入りしました。${ms.length ? `（${ms.join('・')}）` : ''}`, 'big');
  pruneRetired();
}

// ★付き（殿堂入りは最初から付いている）・通算記録のトップに入っている選手は残し、ほかは新しい順に RETIRED_KEEP 人まで
function pruneRetired() {
  const R = S.retired; // 新しい順
  const keep = new Set();
  CAREER_REC.forEach(([k]) => R.slice().sort((a, b) => b.c[k] - a.c[k]).slice(0, REC_TOP).forEach(r => { if (r.c[k] > 0) keep.add(r); }));
  let n = 0;
  S.retired = R.filter(r => r.star || keep.has(r) || ++n <= RETIRED_KEEP);
}

function toggleRetiredStar(id) {
  const r = S.retired.find(x => x.id === id);
  if (r) r.star = !r.star;
}

// ---------- 覚醒 ----------
const AWAKEN_TEXTS = ['フォームを改造して', '先輩のアドバイスで', 'ビデオで自分を研究して', '居残り練習を続けて', 'コーチとの特訓で', '悔しい負けをバネにして', '自主トレで体を作り直して'];
const VETERAN_TEXTS = ['ベテランの意地で', '若手に負けまいと', 'フォームを一から見直して', '引退の二文字を振り払うように'];
// いちばん伸びた能力に合わせたきっかけ（「〇〇が」のあとに続く）
const AWAKEN_KEY_TEXTS = {
  meet: ['バットを短く持つようにして', 'ティー打撃を毎日千本続けて', '逆方向へ打つコツをつかんで', '投手の配球を読めるようになって', 'ボールが止まって見えるようになり'],
  power: ['体重を 10kg 増やして', '打球の角度を研究して', '下半身を使ったスイングを身につけて', 'ウエートトレーニングに打ち込んで', 'フルスイングを恐れなくなって'],
  speed: ['陸上の短距離のコーチに走り方を習って', 'スタートの一歩目を磨いて', '体を絞って身軽になり', 'スパイクを替えて'],
  arm: ['遠投を毎日続けて', '投げ方を一から見直して', '肩の筋力を鍛え直して', '外野から本塁まで届く送球を身につけて'],
  field: ['ノックを毎日受け続けて', '打球への一歩目を磨いて', 'グラブを替えて', '名手の守備をビデオで研究して', '捕ってからの速さを身につけて'],
  velo: ['フォームの体重移動を見直して', '下半身を徹底的に鍛えて', '腕の振りを速くするコツをつかんで', '体を大きくして'],
  control: ['フォームのばらつきをなくして', '捕手と組んで投げ込みを続けて', 'リリースの位置をそろえて', '指先の感覚をつかんで'],
  stamina: ['走り込みを続けて', '力を抜いて投げるコツをつかんで', '体を作り直して', '長い回を投げる配分を覚えて'],
  breaking: ['新しい握りを試して', '先輩から決め球を教わって', '変化球の曲がりを研究して', '手首の使い方を身につけて'],
};

// 型（早熟・普通・晩成）のピークより若く、才能（★）のある選手ほど覚醒しやすい。衰え始めた選手もごくまれに覚醒する
function awakenCheck(mult) {
  S.teams.forEach(t => {
    const fac = 0.9 + t.fac.train * 0.1;
    teamPlayers(t).forEach(p => {
      if (p.inj) return;
      const ageMul = p.age <= p.peak - 3 ? 1.5 : p.age <= p.peak ? 1 : p.age <= p.peak + 1 ? 0.5 : 0.15;
      const ch = 0.0015 * p.pot * p.pot * ageMul * fac * (p.cond >= 4 ? 1.5 : 1) * mult;
      if (U.chance(ch)) awaken(p);
      else limitBreakCheck(p, mult);
    });
  });
}

// 上限解放：停滞している能力の伸びしろの上限が広がり、少し伸びる。衰退期には起きない
function limitBreakCheck(p, mult) {
  if (growthPhase(p).k === 'decline') return;
  const keys = growKeys(p).filter(k => abilStalled(p, k) && ((p.ceilUp && p.ceilUp[k]) || 0) < LIMIT_BREAK_MAX);
  if (!keys.length || !U.chance(LIMIT_BREAK_CHANCE * mult)) return;
  const k = U.pick(keys), before = abilGet(p, k);
  p.ceilUp = p.ceilUp || {};
  p.ceilUp[k] = Math.min(LIMIT_BREAK_MAX, (p.ceilUp[k] || 0) + U.rint(LIMIT_BREAK_UP[0], LIMIT_BREAK_UP[1]));
  abilSet(p, k, Math.min(abilMax(p, k), abilGet(p, k) + U.rint(2, 4)));
  p.limitBroken = (p.limitBroken || 0) + 1;
  if (p.teamId === S.myTeamId) {
    const up = k === 'velo' ? `球速 +${veloKmh(p.a[k]) - veloKmh(before)}km/h` : `${abilLabel(k)} +${Math.round(abilGet(p, k)) - Math.round(before)}`;
    const text = `${p.name}が壁を破った！ ${abilLabel(k)}の伸びしろが広がった（${up}）`;
    addNews('【上限解放】' + text, 'awaken');
    S.popups.push({ pid: p.id, text, limit: true });
  }
}

const BIG_AWAKEN_CHANCE = 0.07; // 覚醒のうち、ごくまれに大爆発（大覚醒）する

function awaken(p) {
  const keys = pickKeys(p);
  const big = U.chance(BIG_AWAKEN_CHANCE);
  const fk = focusToKey(p);
  const main = fk && U.chance(0.6) ? fk : U.pick(keys); // いちばん伸びる能力。きっかけの言葉もこれに合わせる
  const others = U.shuffle(keys.filter(k => k !== main));
  // ふつうは 2 つ、大覚醒は 3 つの能力が大きく伸びる
  const ups = big
    ? [[main, U.rint(18, 28)], [others[0], U.rint(10, 16)], [others[1], U.rint(6, 12)]]
    : [[main, U.rint(8, 15)], [others[0], U.rint(3, 7)]];
  const parts = ups.map(([k, v]) => {
    const before = abilGet(p, k);
    abilSet(p, k, Math.max(before, Math.min(abilMax(p, k), before + v)));
    // 伸びた分だけ伸びしろの上限も広げる（広げないと、上限を超えた能力が「停滞」して練習で伸びなくなる）。転生選手も同じ
    if (abilGet(p, k) > before) {
      p.awakeUp = p.awakeUp || {};
      p.awakeUp[k] = (p.awakeUp[k] || 0) + (abilGet(p, k) - before);
    }
    // 球種の覚醒は、ほかの球種も半分伸びる（1 球種だけだと投手の強さがほとんど変わらないので）
    if (PITCHES[k]) pitchesOf(p).filter(t => t !== k).forEach(t => {
      const b0 = abilGet(p, t);
      abilSet(p, t, Math.max(b0, Math.min(abilMax(p, t), b0 + v * 0.5)));
      p.awakeUp = p.awakeUp || {};
      p.awakeUp[t] = (p.awakeUp[t] || 0) + (abilGet(p, t) - b0);
    });
    if (k === 'velo') return `球速 +${veloKmh(p.a[k]) - veloKmh(before)}km/h`;
    return `${abilLabel(k)} +${Math.round(abilGet(p, k)) - Math.round(before)}`;
  });
  // 球種で覚醒したら、新しい球種も覚える
  if (PITCHES[main]) {
    const t = learnPitch(p);
    if (t) parts.push(`新球種「${PITCHES[t].name}」を習得`);
  }
  p.pot = Math.min(1.7, p.pot + (big ? 0.08 : 0.02));
  p.cond = 5;
  p.awakened = (p.awakened || 0) + 1;
  if (big) p.bigAwakened = (p.bigAwakened || 0) + 1;
  addFame(p, big ? 20 : 6);
  if (p.teamId === S.myTeamId) {
    const keyTexts = AWAKEN_KEY_TEXTS[PITCHES[main] ? 'breaking' : main];
    const keyText = keyTexts && U.chance(0.8) ? U.pick(keyTexts) : null; // ときどきは、どの能力にも合う言葉
    const how = p.age >= p.peak + 2 ? `衰えたと言われていた${p.name}が${keyText || U.pick(VETERAN_TEXTS)}` : `${p.name}が${keyText || U.pick(AWAKEN_TEXTS)}`;
    const text = `${how}${big ? '大覚醒' : '覚醒'}した！ ${parts.join('、')}`;
    addNews((big ? '【大覚醒】' : '【覚醒】') + text, 'awaken');
    S.popups.push({ pid: p.id, text, big });
  }
}

// ---------- FA・年俸調停・サービスタイム（人の言葉 2026-11-20 案6「この案で決める」） ----------
// メジャーの年数で 3 つの段階：3 年未満は調停前、3〜6 年は年俸調停（スーパー 2 もここ）、6 年以上で FA
function hasFA(p) { return (p.svc || 0) >= FA_YEARS; }
function arbEligible(p) { return !!p.on40 && !hasFA(p) && ((p.svc || 0) >= ARB_YEARS || p.super2 === S.year); }
function arbIndex(p) { return U.clamp(Math.floor(p.svc || 0) - ARB_YEARS + (p.s2 ? 1 : 0), 0, ARB_PCT.length - 1); }
function svcText(p) { const v = p.svc || 0, y = Math.floor(v); return `${y}年${Math.round((v - y) * SVC_DAYS)}日`; }
function contractStage(p) { return hasFA(p) ? 'FA権あり' : (p.svc || 0) >= ARB_YEARS || p.s2 ? '調停' : '調停前'; }

// ---------- 成績から見た年俸の目安 ----------
// リーグ全体の OPS と防御率（その日のうちは使い回す）
function lgRates() {
  const key = S.year + '-' + S.day + '-' + S.phase;
  if (S._lgRates && S._lgRates.key === key) return S._lgRates;
  let ab = 0, pa = 0, h = 0, bb = 0, tb = 0, er = 0, outs = 0;
  Object.values(S.players).forEach(p => {
    const st = p.stats;
    if (!st) return;
    pa += st.pa; ab += st.ab; h += st.h; bb += st.bb; tb += st.h + st.d + st.t * 2 + st.hr * 3;
    er += st.per; outs += st.outs;
  });
  const r = { key, ops: pa ? (h + bb) / pa + (ab ? tb / ab : 0) : 0.7, era: outs > 300 ? er * 27 / outs : 3.7 };
  Object.defineProperty(S, '_lgRates', { value: r, writable: true, configurable: true, enumerable: false }); // セーブには入れない
  return r;
}

// その年の貢献（勝利数の目安。リーグ平均の選手が 1 年出ると 2 くらい）
function seasonWins(p) {
  const st = p.stats, lg = lgRates();
  const full = 143 / Math.max(1, S.games || 162); // 元のペナント監督の 143 試合の見方に直す
  let w = 0;
  if (canBat(p) && st.pa > 0) {
    const pos = (p.isP ? p.pos2 : p.pos);
    w += (ops(st) - lg.ops * 0.82 + (pos === '捕' || pos === '遊' ? 0.04 : 0)) * st.pa * full / 600 * 16;
  }
  if (canPitch(p) && st.outs > 0) {
    w += (lg.era * 1.3 - st.per * 27 / st.outs) * st.outs * full / 27 / 10 + st.sv * full * 0.05;
  }
  return w;
}
function playedEnough(p) { const st = p.stats; return st.pa >= 100 || st.outs >= 60; }
function perfSalary(p) {
  const w = Math.max(0, seasonWins(p));
  return Math.round(softSal(realSal(800 + w * SAL_PER_WIN + w * w * SAL_PER_WIN2)));
}
// その選手の力と今季の成績から見た 1 年の値打ち（万ドル）。歳を取るほど下がる（仮・AI）
function marketValue(p) {
  const ability = calcSalary(p);
  const perf = playedEnough(p) ? perfSalary(p) : ability * 0.6;
  const age = p.age >= 36 ? 0.6 : p.age >= 33 ? 0.8 : p.age <= 27 ? 1.1 : 1;
  return Math.max(MIN_SALARY, Math.round((perf * 0.6 + ability * 0.4) * age));
}
// FA 市場での相場（年俸）
function faMarket(p) { return Math.max(MIN_SALARY, Math.round(marketValue(p) * FA_PREMIUM)); }
// 調停前の年俸：最低年俸から、毎年少しずつ上がるだけ
function preArbSalary(p) { return Math.max(p.salary || 0, Math.round(MIN_SALARY * (1 + PRE_ARB_RAISE * Math.floor(p.svc || 0)))); }
// 調停の相場：FA の相場の何割か（何年目かで上がる）。前の年より下がりにくい
function arbFair(p) { return Math.max(p.salary || MIN_SALARY, Math.round(marketValue(p) * ARB_PCT[arbIndex(p)])); }
function arbAsk(p) { return Math.round((p.arbFair || arbFair(p)) * ARB_ASK); }
// 来季の年俸の見込み（年俸の一覧で使う）
function renewSalary(p) {
  if (!p.on40) return MINOR_PAY;
  if (p.contractYears > 0) return p.salary;
  if (hasFA(p)) return faMarket(p);
  if (arbEligible(p) || (p.svc || 0) >= ARB_YEARS) return arbFair(p);
  return preArbSalary(p);
}

// クオリファイング・オファーの額：上位 125 人の年俸の平均（1 年契約）
function qoAmount() {
  const top = Object.values(S.players).filter(p => p.teamId != null && p.on40).map(p => p.salary).sort((a, b) => b - a).slice(0, QO_TOP);
  return Math.round(U.sum(top) / Math.max(1, top.length));
}
// QO を受ける見込み。相場が QO より低いほど受けやすい（仮・AI）
function qoAccept(p, qo) { const mv = faMarket(p); return mv < qo * 0.8 ? 0.8 : mv < qo ? 0.45 : mv < qo * 1.3 ? 0.15 : 0.03; }

// 残留の提示があったときに、それでも FA 市場に出る確率。提示がなければ、みんな市場に出る
function declareChance(p, retain) {
  const r = retainOffer(retain);
  if (!r) return 1;
  const t = S.teams[p.teamId];
  let c = 0.75 - (p.loyalty / 100) * 0.9;
  if (faMarket(p) > p.salary * 1.2) c += 0.15;
  if (rankOf(t.id) >= 5) c += 0.1;
  if (p.age >= 35) c -= 0.35;
  if (ovr(p) < 50) c -= 0.25;
  if (ovr(p) >= 62) c += 0.15; // 主力ほど大きな契約を求めて市場に出やすい
  if (isHomeTeam(p, t)) c -= 0.12; // 地元の球団には少し残りやすい
  if (ovr(p) >= FA_PLAY_MIN_OVR) c += (1 - playShare(p)) * FA_PLAY_DECLARE; // 出られなかった選手は、出場機会を求めて出ていきやすい
  c -= U.clamp((r.mul - 0.7) * 0.5, 0, 0.5) + (r.years - 1) * (p.age >= 32 ? 0.08 : 0.04); // 年俸が高いほど、年数が長いほど残りやすい
  return U.clamp(c, 0.02, 0.9);
}

// 残留の提示 { mul（FA 相場に掛ける倍率）, years }
function retainOffer(v) { return v || null; }
function retainSalary(p, r) { return Math.round(faMarket(p) * r.mul); }

// 今季どれだけ出られたか（0〜1）。野手は規定打席、投手は 1 試合 1 アウトで 1
function playShare(p) {
  const s = p.stats || {};
  return U.clamp(canPitch(p) && !(canBat(p) && s.pa > s.outs) ? s.outs / S.games : s.pa / (S.games * 3.1), 0, 1);
}
// その球団に入ったら何番手か（40 人枠の同じ投手・野手の中で、総合が上の選手の数 ＋1）
function depthAt(t, p) {
  const o = ovr(p);
  return fortyOf(t).filter(x => x.id !== p.id && x.isP === p.isP && ovr(x) > o).length + 1;
}
function regularAt(t, p) { return depthAt(t, p) <= (p.isP ? 10 : 9); }

function isHomeTeam(p, t) { return !!p.home && TEAM_PREF[t.short] === p.home; }

function faMood(c) { return c < 0.2 ? '残留濃厚' : c < 0.4 ? '残留寄り' : c < 0.6 ? '五分五分' : '移籍も視野'; }

function offFAStart() {
  const eligible = [];
  S.teams.forEach(t => teamPlayers(t).forEach(p => { if (p.on40 && hasFA(p) && !(p.contractYears > 0) && !p.retireNext) eligible.push(p.id); })); // 契約の途中と、引退を表明した選手は FA にならない
  S.off.fa = { stage: 'pre', eligible, retain: {}, qo: {}, declared: [], myBids: {}, results: [], qoAmt: qoAmount() };
  S.off.step = 'fa';
}

function setRetain(pid, mul, years) {
  if (!mul) delete S.off.fa.retain[pid];
  else S.off.fa.retain[pid] = { mul, years };
}
function setQO(pid, on) { if (on) S.off.fa.qo[pid] = true; else delete S.off.fa.qo[pid]; }

// FA の権利を持つ選手が、残留の提示・QO を受けるか、市場に出るかを決める
function offFADeclare() {
  const F = S.off.fa;
  const qo = F.qoAmt || qoAmount();
  F.eligible.forEach(id => {
    const p = S.players[id];
    if (!p || p.teamId == null) return;
    const t = S.teams[p.teamId];
    const mine = t.id === S.myTeamId;
    const mv = faMarket(p);
    const giveQO = !p.qoGot && (mine ? !!F.qo[id] : mv >= qo * 0.9 && p.age <= 33 && U.chance(0.8));
    if (giveQO) p.qoGot = true; // QO は 1 人 1 回まで
    // ほかの球団は、いい選手なら残留の条件を出す
    const retain = retainOffer(mine ? F.retain[id] : (ovr(p) >= 60 && U.chance(0.5) ? { mul: 1, years: p.age <= 30 ? U.rint(2, 5) : 1 } : null));
    if (retain && !U.chance(declareChance(p, retain))) {
      p.salary = retainSalary(p, retain);
      delete p.contractNow;
      p.contractYears = retain.years; // このオフの契約の手続きで 1 つ減り、来季から提示した年数だけ年俸が固定される
      addLoyalty(p, 5);
      if (mine) addNews(`${p.name}は提示を受け入れ、残留を決めました（${retain.years}年・年俸${U.money(p.salary)}）。`, 'good');
      return;
    }
    if (giveQO && U.chance(qoAccept(p, qo))) {
      p.salary = qo; delete p.contractNow; p.contractYears = 1;
      addNews(`${p.name}（${t.short}）がクオリファイング・オファー（1年・${U.money(qo)}）を受けて残ります。`, mine ? 'good' : '');
      return;
    }
    if (mine && retain) addNews(`${p.name}は残留の提示（${retain.years}年・年俸${U.money(retainSalary(p, retain))}）を断りました。`, 'bad');
    const why = ovr(p) >= FA_PLAY_MIN_OVR && playShare(p) < 0.4 ? '出場機会を求めて' : '';
    F.declared.push({ pid: id, from: t.id, oldSalary: p.salary, mv, qo: giveQO, bids: aiBids(p, t) });
    removeFromTeam(p);
    p.lastTeam = t.short;
    if (mine || ovr(p) >= 65) addNews(`${p.name}（${t.short}・${p.isP ? '投手' : p.pos}）が${why}FA市場に出ました${giveQO ? '（QO を断った）' : ''}。`, mine ? 'bad' : '');
  });
  F.stage = 'market';
}

// 他球団の条件。40 人枠で弱いところを埋められる選手なら手を挙げる。年俸の合計は市場の大きさの目安まで（仮・AI）
function aiBids(p, from) {
  const bids = [];
  const mv = faMarket(p);
  S.teams.forEach(t => {
    if (t.id === S.myTeamId) return;
    const same = fortyOf(t).filter(x => x.isP === p.isP && x.id !== p.id).map(ovr).sort((a, b) => b - a);
    const bar = same[p.isP ? 9 : 8] || 0; // 投手は 10 番手、野手は 9 番手より上なら欲しい
    const former = t.id === from.id;
    const want = ovr(p) > bar + (former ? -5 : -2);
    if (!want || !U.chance(former ? 0.55 : 0.45)) return;
    const salary = Math.round(mv * U.rnd(0.9, mv > SAL_SOFT ? 1.05 : 1.25)); // 高い選手には、相場を大きく超える額は出さない
    if (t.money < salary * 1.2) return;
    if (payroll(t) + salary > MARKETS[t.mk].budget && t.money < salary * 4) return; // お金持ちの球団でなければ、目安を超える補強はしない
    const star = mv >= 1500;
    bids.push({ team: t.id, salary, years: p.age <= 30 ? (star ? U.rint(4, 8) : U.rint(2, 4)) : p.age <= 33 ? U.rint(1, star ? 4 : 2) : 1 });
  });
  // 手を挙げるのは多くても 5 球団
  return U.shuffle(bids).slice(0, 5);
}

function setMyBid(pid, mul, years) {
  const F = S.off.fa;
  const d = F.declared.find(x => x.pid === pid);
  const t = myTeam();
  if (!d) return 'その選手はいません。';
  if (mul == null) { delete F.myBids[pid]; return null; }
  if (count40(t) + Object.keys(F.myBids).filter(k => +k !== pid).length >= FORTY_MAX) return '40人枠に空きがありません（申し込んでいる人数ぶんの空きが要ります）。';
  const salary = Math.round(d.mv * mul);
  if (t.money < salary) return 'お金が足りません（1 年目の年俸が払えません）。';
  F.myBids[pid] = { salary, years, mul };
  return null;
}

// 選手がどの球団を選ぶか。条件・年数・チームの強さと人気・元の球団への忠誠心で決まる
function bidScore(p, d, b) {
  const t = S.teams[b.team];
  const yearW = p.age >= 32 ? 0.12 : 0.06;
  let f = 1 + (pct(t) - 0.5) * 0.4 + (t.pop - 50) / 500 + U.rnd(-0.06, 0.06);
  if (b.team === d.from) f += (p.loyalty / 100) * 0.5;
  if (isHomeTeam(p, t)) f += 0.12; // 地元の球団には少し行きやすい
  if (!regularAt(t, p)) f -= FA_PLAY_PICK * (2 - playShare(p)); // 出られそうにない球団は避ける
  return b.salary * (1 + yearW * (b.years - 1)) * f;
}

function offFAResolve() {
  const F = S.off.fa;
  F.declared.forEach(d => {
    const p = S.players[d.pid];
    const bids = d.bids.slice();
    const mine = F.myBids[d.pid];
    if (mine) bids.push({ team: S.myTeamId, salary: mine.salary, years: mine.years });
    let best = null, bs = -1;
    bids.forEach(b => { const v = bidScore(p, d, b); if (v > bs) { bs = v; best = b; } });
    const from = S.teams[d.from];
    if (!best) {
      // どこからも声がかからなければ、自由契約のまま春まで待つ
      p.salary = faDemand(p); p.faYears = 0; p.contractYears = 0; delete p.contractNow;
      S.freeAgents.push(p.id);
      F.results.push({ pid: d.pid, name: p.name, from: d.from, to: null, salary: p.salary, years: 0, bids: 0, note: '契約先なし（自由契約へ）' });
      return;
    }
    const to = S.teams[best.team];
    sign40(to, p);
    p.salary = best.salary;
    delete p.contractNow;
    p.contractYears = best.years; // このオフの契約の手続きで 1 つ減り、来季から best.years 年ぶん年俸が固定される
    let note = to.id === from.id ? '残留' : '移籍';
    if (to.id !== from.id) {
      p.loyalty = 50;
      // QO を断った選手を取ったら、元の球団に補償の指名権（1 巡目のあと）、取った球団は 2 巡目の指名権を失う
      if (d.qo) {
        S.pickTrades.push({ year: S.year + 1, kind: 'comp', team: from.id, name: p.name }, { year: S.year + 1, kind: 'lose', round: 2, team: to.id, name: p.name });
        note += '・QO の補償';
      }
    } else addLoyalty(p, 10);
    if (to.id !== S.myTeamId) { aiTrim40(to); autoActive(to); }
    F.results.push({ pid: d.pid, name: p.name, from: d.from, to: to.id, salary: best.salary, years: best.years, bids: bids.length, note });
    const involved = to.id === S.myTeamId || from.id === S.myTeamId;
    if (involved || best.salary >= 1500) addNews(`FA：${p.name}が${to.id === from.id ? `${to.short}に残留` : `${from.short}から${to.short}へ移籍`}（${best.years}年・年俸${U.money(best.salary)}${d.qo && to.id !== from.id ? '・QO の補償あり' : ''}）`,
      involved ? (to.id === S.myTeamId ? 'good' : 'bad') : '');
  });
  F.stage = 'done';
}

// ---------- オフ ----------
// 永久欠番の候補：その球団で長く活躍した名選手。自分の球団は候補に出し、ほかの球団は大選手なら自分で決める
function honorCheck(t, p, honor) {
  if (p.no == null || (t.retiredNos || []).some(r => r.no === p.no)) return;
  const years = (p.career || []).filter(c => c.t === t.short).length;
  if (years < RETIRE_NO_YEARS) return;
  const m = meritOf(p);
  if (m < RETIRE_NO_MERIT) return;
  if (t.id === S.myTeamId) honor.push({ name: p.name, no: p.no, years, merit: Math.round(m * 100), card: honorCard(p) });
  else if (m >= RETIRE_NO_AUTO && years >= RETIRE_NO_AUTO_YEARS && U.chance(RETIRE_NO_AUTO_CHANCE)) retireNumber(t, p.no, p.name);
}

// 候補の成績（選手はこのあと消えるので、見るための分だけ写しておく。次のシーズンが始まると S.off ごと消える）
function honorCard(p) {
  const rows = (p.career || []).map(c => ({ y: c.y, t: c.t, s: c.s }));
  const tags = [['as', 'オールスター'], ['b9', 'ベストナイン'], ['gg', '名手賞']];
  return {
    pos: canPitch(p) && !p.twoWay ? '投' : p.twoWay ? '二刀流' : p.pos, age: p.age,
    bat: canBat(p), pit: canPitch(p), twoWay: !!p.twoWay, rows, total: careerTotal(p),
    titles: titlesOf(p.id).map(t => `${t.year} ${t.title}`),
    ms: MILESTONES.filter(m => careerTotal(p)[m.k] >= byGames(m.n)).map(m => m.label),
    honors: tags.filter(([k]) => p[k]).map(([k, w]) => `${w}×${p[k]}`),
  };
}

// 契約の途中か（最終年は残りの年数が 0 なので contractNow で見分ける）。あと何年かは今の年も数える
function underContract(p) { return p.contractYears > 0 || !!p.contractNow; }
function contractLeft(p) { return (p.contractYears || 0) + (p.contractNow ? 1 : 0); }
function retireLeave(p) {
  retireRecord(p);
  removeFromTeam(p);
  delete S.players[p.id];
}
// 慰留しなかった（断られた）選手を、ここで引退させる
function retireFinish() {
  Object.values(S.players).filter(p => p.retiring).forEach(retireLeave);
}
// 慰留して残ってくれる見込み
function retainChance(p) {
  const ca = careerAge(p);
  if (ca >= RETIRE_MAX_AGE) return RETAIN_MIN;
  return U.clamp(RETAIN_BASE + (p.loyalty || 0) / 100 * RETAIN_LOYAL - Math.max(0, ca - RETAIN_AGE) * RETAIN_AGE_DROP, RETAIN_MIN, RETAIN_MAX);
}
// 慰留する。残ったら、ほかの選手と同じく 1 つ歳を取り、上乗せした年俸の 1 年契約になる
function retainPlayer(r) {
  const p = S.players[r.pid];
  if (!p || !p.retiring || r.res) return null;
  const ok = U.chance(retainChance(p));
  r.res = ok ? 'stay' : 'no';
  if (!ok) return false;
  p.retiring = false;
  const old = p.salary;
  p.salary = Math.max(MIN_SALARY, Math.round(marketValue(p) * (1 + RETAIN_RAISE)));
  p.contractYears = 0;
  p.contractNow = true;
  agePlayer(p);
  addLoyalty(p, 3);
  const c = S.off.contract;
  c.raises.push({ pid: p.id, name: p.name, old, now: p.salary, locked: true, kind: '慰留' });
  c.honor = (c.honor || []).filter(x => x.name !== p.name || x.done); // 引退しないので、永久欠番の候補から外す
  addNews(`${p.name}が慰留を受け入れ、現役を続けることになりました。`, 'big');
  return true;
}

function retireChance(p, ca, o, part = 1) {
  const st = p.stats, scale = Math.max(1, S.games || 162) / 162 * part; // part: シーズンの終わりごろに決めるときは、そこまでに出られる試合の割合
  const low = (st.injd || 0) < RETIRE_INJ_DAYS // 長くケガをしていた年は数えない
    && (!canBat(p) || st.g < RETIRE_LOW_G * scale) && (!canPitch(p) || st.pg < RETIRE_LOW_PG * scale);
  if (ca >= RETIRE_MAX_AGE) return 0.9; // 43 歳前後でほぼ全員
  if (!p.on40) return ca >= 34 ? 0.5 : ca >= 31 && o < 48 ? 0.3 : 0; // マイナー契約のベテランは、早めにやめる
  if (low) return ca >= 36 ? 0.8 : ca >= 33 ? 0.5 : ca >= 30 ? 0.25 : 0;
  if (ca >= 38 && o < 50) return 0.5; // 出てはいても、力が大きく落ちた
  if (ca >= 31 && o < 45) return 0.5;
  return 0;
}

function isRookie(p) { return !!p.drafted && p.drafted.year === S.year; }
// 今季かぎりで引退するか（契約が残っているあいだは引退しない）
function willRetire(p, part) {
  if (p.contractYears > 0 || isRookie(p)) return false;
  return U.chance(retireChance(p, careerAge(p), ovr(p), part));
}
// シーズンの終わりごろに、今季かぎりで引退する選手を決めて発表する
function announceRetire() {
  S.retireYear = S.year;
  const part = S.day / S.schedule.length, my = [], big = [];
  S.teams.forEach(t => teamPlayers(t).forEach(p => {
    if (!willRetire(p, part)) return;
    p.retireNext = true;
    if (t.id === S.myTeamId && p.on40) my.push(p);
    else if (meritOf(p) >= 0.3) big.push(`${p.name}（${t.short}）`);
  }));
  my.forEach(p => addNews(`${p.name}（${p.age}歳）が、今季かぎりでの現役引退を表明しました。オフの契約の手続きで慰留できます。`, 'big'));
  if (big.length) addNews(`ほかの球団では、${big.join('・')}が今季かぎりでの引退を表明しました。`);
}

// 契約の手続き（FA のあと）：引退・調停前の年俸・スーパー 2・調停に入れる選手の一覧（ノンテンダーを決める）・年を取る
function offContract() {
  const my = myTeam();
  const retired = [], raises = [], honor = [], tender = [];
  S.teams.forEach(t => {
    teamPlayers(t).forEach(p => {
      const o = ovr(p);
      const leave = S.retireYear === S.year ? !!p.retireNext : willRetire(p); // シーズン中に表明した選手が引退する
      delete p.retireNext;
      if (!leave) return;
      const can = t.id === my.id && p.on40;
      if (t.id === my.id && p.on40) retired.push({ pid: p.id, name: p.name, age: p.age, why: '引退', can, pos: p.isP ? '投' : p.pos, ovr: Math.round(o), abil: abilKeys(p).map(k => [k, Math.round(p.a[k])]), pit: canPitch(p) ? pitchesOf(p).map(x => [x, pitchLevel(p, x)]) : undefined }); // 引退した選手はデータが消えるので、強さを写しておく
      honorCheck(t, p, honor);
      if (can) p.retiring = true; // ルール 5 へ進むときに引退する（retireFinish）
      else retireLeave(p);
    });
  });
  agingFreeAgents();
  // スーパー 2：2〜3 年の選手のうち、年数の長い上位 2 割ほど
  const two = Object.values(S.players).filter(p => p.teamId != null && p.on40 && p.svc >= 2 && p.svc < ARB_YEARS).sort((a, b) => b.svc - a.svc);
  two.slice(0, Math.round(two.length * SUPER2_SHARE)).forEach(p => { p.super2 = S.year; p.s2 = true; });
  S.teams.forEach(t => {
    teamPlayers(t).forEach(p => {
      if (p.retiring) return;
      const old = p.salary;
      let kind;
      if (p.contractYears > 0) { p.contractYears--; p.contractNow = true; kind = '契約中'; } // 契約のあいだは年俸がそのまま
      else {
        delete p.contractNow;
        if (!p.on40) { p.salary = MINOR_PAY; kind = 'マイナー契約'; }
        else if (arbEligible(p)) { p.arbFair = arbFair(p); kind = '調停'; tender.push(p.id); }
        else if (!hasFA(p)) { p.salary = preArbSalary(p); kind = '調停前'; }
        else kind = 'FA権あり';
      }
      agePlayer(p);
      if (t.id === my.id && p.on40) raises.push({ pid: p.id, name: p.name, old, now: p.salary, locked: kind === '契約中', kind });
      addLoyalty(p, 3 + (t.goods.some(g => g.pid === p.id) ? 5 : 0));
      if (t.id === my.id && p.genius && !p.geniusKnown) {
        p.geniusKnown = true;
        addNews(`1 年見てきて分かった。${p.name}は「天才」だ！（伸びが段ちがい）`, 'awaken');
      }
    });
  });
  raises.sort((a, b) => (b.now - b.old) - (a.now - a.old));
  const myTender = {};
  tender.filter(id => S.players[id].teamId === my.id).forEach(id => { myTender[id] = true; });
  S.off.contract = { retired, raises, honor, tender, myTender };
  S.off.step = 'contract';
}

// ノンテンダーの期限：調停に入れる選手と契約するか決める。しない選手は FA になる（人の言葉 2026-11-20 案6）
function offTenderFinish() {
  const C = S.off.contract;
  if (!C || C.tendered) return;
  C.tendered = true;
  const non = [];
  C.tender.forEach(id => {
    const p = S.players[id];
    if (!p || p.teamId == null || !arbEligible(p)) return;
    const t = S.teams[p.teamId];
    const keep = t.id === S.myTeamId ? C.myTender[id] !== false : p.arbFair <= calcSalary(p) * 1.3 || (p.age <= 26 && p.pot >= 1.05);
    if (keep) return;
    non.push(`${p.name}（${t.short}）`);
    if (t.id === S.myTeamId) addNews(`${p.name}とは契約しませんでした（ノンテンダー）。FA になります。`, 'bad');
    toFreeAgent(p);
  });
  if (non.length) addNews(`ノンテンダー：${non.length}人が契約されずに FA になりました（「自由契約」の画面で見られます）。`);
}

// 複数年契約を申し込む（1 人 1 回）。base は、その段階の選手の見込みの年俸（調停前・調停の選手は、そのぶん安い）
function extendBase(p) { return Math.round(marketValue(p) * (hasFA(p) ? 1 : arbEligible(p) || (p.svc || 0) >= ARB_YEARS ? 0.75 : 0.55)); }
function extendChance(p, mul, years) {
  const age = p.age >= 32 ? 1 : p.age <= 25 ? -1 : 0;
  return U.clamp(EXTEND_BASE + (p.loyalty || 0) / 100 * EXTEND_LOYAL + (mul - 1) * EXTEND_PAY + age * EXTEND_YEAR * (years - 1), 0.05, 0.95);
}
function extendPlayer(r, mul, years) {
  const p = S.players[r.pid];
  if (!p || p.teamId !== S.myTeamId || r.locked || r.ext) return null;
  const ok = U.chance(extendChance(p, mul, years));
  r.ext = ok ? 'yes' : 'no';
  if (!ok) return false;
  p.salary = Math.round(extendBase(p) * mul);
  p.contractYears = years - 1; // このオフの手続きは済んでいるので、来季を含めて years 年
  p.contractNow = true;
  delete p.arbFair;
  if (S.off.contract) S.off.contract.tender = S.off.contract.tender.filter(id => id !== p.id); // 契約したので調停はしない
  r.now = p.salary;
  r.years = years;
  addLoyalty(p, 3);
  addNews(`${p.name}と${years}年契約を結びました（年俸${U.money(p.salary)}）。`, 'good');
  return true;
}

// ---------- ルール 5 ドラフト（12 月。人の言葉 2026-11-20 案7） ----------
// 40 人枠の外に長くいる選手：18 歳以下で入ったら 5 回目、19 歳以上で入ったら 4 回目のルール 5 から
function r5Eligible(p) {
  if (p.teamId == null || p.on40 || p.signYear == null) return false;
  return S.year - p.signYear + 1 >= ((p.signAge || 20) <= 18 ? R5_YOUNG : R5_OLD);
}
// ほかの球団は、ルール 5 の前に、取られそうな有望株を 40 人枠に入れて守る
function aiProtect(t) {
  if (t.id === S.myTeamId) return;
  const cand = minorsOf(t).filter(r5Eligible).sort((a, b) => tradeValue(b) - tradeValue(a));
  cand.forEach(p => {
    if (count40(t) < FORTY_MAX) { add40(p); return; }
    const worst = fortyOf(t).filter(x => !underContract(x)).sort((a, b) => tradeValue(a) - tradeValue(b))[0];
    if (worst && tradeValue(p) > tradeValue(worst) * 1.2) { drop40(worst); add40(p); }
  });
}
function offRule5Start() {
  retireFinish();
  offTenderFinish();
  S.teams.forEach(aiProtect);
  const order = sortTeams(S.teams).reverse().map(t => t.id); // 今季の成績の悪い順
  S.off.r5 = { order, idx: 0, picks: [], myDone: false };
  S.off.step = 'rule5';
  r5RunAI();
}
// 取れる選手（ほかの球団の、40 人枠の外の対象選手）
function r5Pool(tid) { return Object.values(S.players).filter(p => r5Eligible(p) && p.teamId !== tid); }
function r5Pick(tid, p) {
  const from = S.teams[p.teamId], to = S.teams[tid];
  removeFromTeam(p);
  sign40(to, p);
  p.r5 = { from: from.id, to: to.id, year: S.year + 1 };
  to.money -= R5_COST; from.money += R5_COST;
  if (to.id === S.myTeamId) to.fin.invest += R5_COST;
  S.off.r5.picks.push({ pid: p.id, name: p.name, from: from.id, to: to.id });
  addNews(`ルール5：${to.short}が${from.short}の${p.name}（${p.isP ? '投手' : p.pos}・${p.age}歳）を指名しました。`, to.id === S.myTeamId ? 'good' : from.id === S.myTeamId ? 'bad' : '');
}
function r5RunAI() {
  const R = S.off.r5;
  while (R.idx < R.order.length) {
    const tid = R.order[R.idx];
    if (tid === S.myTeamId && !R.myDone) return;
    if (tid !== S.myTeamId) {
      const t = S.teams[tid];
      if (count40(t) < FORTY_MAX && U.chance(0.5)) {
        const bar = p => { const same = activePlayers(t).filter(x => x.isP === p.isP).map(ovr).sort((a, b) => a - b); return same[0] || 0; };
        const best = r5Pool(tid).filter(p => p.age <= 27 && ovr(p) >= bar(p) - 1).sort((a, b) => tradeValue(b) - tradeValue(a))[0];
        if (best) r5Pick(tid, best);
      }
    }
    R.idx++;
  }
}
function r5MyPick(pid) {
  const t = myTeam(), p = S.players[pid];
  if (!p || !r5Eligible(p) || p.teamId === t.id) return 'その選手は指名できません。';
  if (count40(t) >= FORTY_MAX) return '40人枠に空きがありません。';
  if (t.money < R5_COST) return 'お金が足りません。';
  r5Pick(t.id, p);
  S.off.r5.myDone = true;
  S.off.r5.idx++;
  r5RunAI();
  return null;
}
function r5Pass() { const R = S.off.r5; R.myDone = true; if (R.order[R.idx] === S.myTeamId) R.idx++; r5RunAI(); }
// ルール 5 で取った選手を 26 人枠から外したら、元の球団に返す
function r5Return(p) {
  const from = S.teams[p.r5.from], to = S.teams[p.teamId];
  removeFromTeam(p);
  signPlayer(from, p); p.lvl = '3A'; p.salary = MINOR_PAY;
  to.money += Math.round(R5_COST / 2); from.money -= Math.round(R5_COST / 2);
  addNews(`ルール5で取った${p.name}を26人枠から外したので、${from.short}に返しました。`, to.id === S.myTeamId ? 'bad' : '');
}

// ---------- 年俸調停（1〜2 月。人の言葉 2026-11-20 案6） ----------
// 選手と球団がそれぞれ額を出し、合わなければ調停。調停の見る額（相場）に近いほうの額に決まる
function arbHearing(p, ask, offer) {
  const fair = (p.arbFair || arbFair(p)) * (1 + U.gauss() * 0.04);
  const playerWins = fair >= (ask + offer) / 2;
  return { win: playerWins ? 'player' : 'team', salary: playerWins ? ask : offer };
}
function offArbStart() {
  const C = S.off.contract;
  const ids = (C ? C.tender : []).filter(id => S.players[id] && S.players[id].teamId != null && arbEligible(S.players[id]) && !(S.players[id].contractYears > 0));
  const mine = [];
  ids.forEach(id => {
    const p = S.players[id], t = S.teams[p.teamId], ask = arbAsk(p);
    if (t.id === S.myTeamId) { mine.push({ pid: id, ask, fair: p.arbFair, res: null }); return; }
    // ほかの球団：半分くらいは間を取って合意、残りは調停
    if (U.chance(0.5)) { p.salary = Math.round((ask + p.arbFair) / 2); return; }
    const r = arbHearing(p, ask, Math.round(p.arbFair * U.rnd(0.88, 0.97)));
    p.salary = r.salary;
  });
  S.off.arb = { list: mine };
  S.off.step = 'arb';
}
// 自分の選手の調停。mode：'agree'（選手の額で合意）・数字（球団の出す額で調停）
function arbResolve(i, offer) {
  const A = S.off.arb, r = A.list[i];
  if (!r || r.res) return null;
  const p = S.players[r.pid];
  if (offer === 'agree') { p.salary = r.ask; r.res = { win: 'agree', salary: r.ask }; addNews(`${p.name}と年俸${U.money(r.ask)}で合意しました。`); return r.res; }
  const off = Math.max(MIN_SALARY, Math.round(offer));
  if (off >= r.ask) { p.salary = r.ask; r.res = { win: 'agree', salary: r.ask }; return r.res; }
  const res = arbHearing(p, r.ask, off);
  p.salary = res.salary;
  r.res = { ...res, offer: off };
  if (res.win === 'player') addLoyalty(p, -5); // 調停で負けると、選手の額に決まり、忠誠心も少し下がる
  addNews(`年俸調停：${p.name}は${res.win === 'player' ? `選手の額（${U.money(r.ask)}）` : `球団の額（${U.money(off)}）`}に決まりました。`, res.win === 'player' ? 'bad' : 'good');
  return r.res;
}
function offArbFinish() {
  const A = S.off.arb;
  if (!A || A.done) return;
  A.done = true;
  A.list.forEach((r, i) => { if (!r.res) arbResolve(i, Math.round(r.fair * 0.95)); });
  Object.values(S.players).forEach(p => { delete p.arbFair; });
}

// ---------- 国際アマ契約・アジアからのポスティング（1 月から。人の言葉 2026-11-20 案7） ----------
function intlPool(t) { return MARKETS[t.mk].intl; }
function offIntlStart() {
  offArbFinish();
  const pool = [];
  for (let i = 0; i < INTL_N; i++) {
    const isP = U.chance(0.45);
    const pot = U.clamp(0.97 + U.gauss() * 0.28 + 0.08, 0.6, 1.75);
    const p = newPlayer(S, { isP, q: U.rnd(16, 34), age: 16, pot, nat: U.pickW(INTL_NAT_W) });
    p.kind = '国際';
    p.salary = MINOR_PAY;
    finishProspect(p, '国際');
    p.noise.rep *= INTL_REP_MUL; // 16 歳なので、才能はドラフトよりさらに見えにくい
    pool.push(p.id);
  }
  // 希望の契約金：世間の評判の順に高い
  pool.map(id => S.players[id]).sort((a, b) => aiDraftValue(b, -1) - aiDraftValue(a, -1)).forEach((p, i) => { p.ask = Math.round(U.clamp(450 * Math.exp(-i / 12) + 10, 10, 500)); });
  // アジアのプロ（架空の日本・韓国のリーグ）からのポスティング
  const asia = [];
  for (let i = 0, n = U.rint(ASIA_N[0], ASIA_N[1]); i < n; i++) {
    const nat = U.chance(0.65) ? '日本' : '韓国';
    const age = U.rint(20, 31);
    const p = newPlayer(S, { isP: U.chance(0.5), q: U.rnd(58, 76) - Math.max(0, 24 - age) * 1.5, age, nat });
    p.kind = 'アジア';
    p.amateur = { kind: 'アジア', team: `${nat}・${U.pick(ASIA_CLUBS[nat])}`, line: `${nat}のリーグで${U.rint(2, Math.max(2, age - 18))}年プレー`, title: ovr(p) >= 70 ? `${nat}のリーグで MVP` : '' };
    if (age < ASIA_MINOR_AGE) p.ask = Math.round(U.rnd(150, 450));
    else { p.mv = Math.round(faMarket(p) * U.rnd(0.9, 1.15)); p.years = U.clamp(Math.round(2 + (ovr(p) - 62) / 4 + (30 - age) * 0.4), 1, 8); }
    p.salary = MINOR_PAY;
    asia.push(p.id);
  }
  S.off.intl = { pool, asia, spent: {}, offers: {}, results: [], done: false };
  S.off.step = 'intl';
  addNews(`国際アマ契約の期間が始まりました。16 歳の候補 ${INTL_N} 人と、アジアのプロからポスティングされた ${asia.length} 人と交渉できます。`, 'big');
}
function intlSpent(tid) { return (S.off.intl.spent[tid] || 0); }
function intlLeft(t) { return intlPool(t) - intlSpent(t.id); }
// 自分の申し込み（16 歳・25 歳未満のアジアの選手は契約金、25 歳以上は年俸と年数）
function setIntlOffer(pid, v, years) {
  const I = S.off.intl, p = S.players[pid], t = myTeam();
  if (v == null) { delete I.offers[pid]; return null; }
  if (p.mv) {
    if (count40(t) + Object.keys(I.offers).filter(k => S.players[k] && S.players[k].mv && +k !== pid).length >= FORTY_MAX) return '40人枠に空きがありません。';
    I.offers[pid] = { salary: Math.max(MIN_SALARY, Math.round(v)), years: years || p.years };
    return null;
  }
  const bonus = Math.max(1, Math.round(v));
  const used = U.sum(Object.keys(I.offers).filter(k => +k !== pid && !(S.players[k] || {}).mv), k => I.offers[k].bonus);
  if (used + bonus > intlLeft(t)) return `契約金の枠（残り${U.money(intlLeft(t) - used)}）を超えます。`;
  I.offers[pid] = { bonus };
  return null;
}
// 締め切り：評判の高い順に、選手がいちばん良い条件の球団を選ぶ
function offIntlFinish() {
  const I = S.off.intl;
  if (!I || I.done) return;
  I.done = true;
  const my = myTeam();
  const vals = id => aiDraftValue(S.players[id], -1);
  [...I.asia, ...I.pool].sort((a, b) => vals(b) - vals(a)).forEach(id => {
    const p = S.players[id];
    if (!p) return;
    const mine = I.offers[id];
    if (p.mv) { // 25 歳以上のアジアの選手：FA と同じように年俸を出し合う
      const d = { from: -1, mv: p.mv };
      const bids = aiBids(p, { id: -1 }).map(b => ({ ...b, years: p.years }));
      if (mine) bids.push({ team: my.id, salary: mine.salary, years: mine.years });
      let best = null, bs = -1;
      bids.forEach(b => { const v = bidScore(p, d, b); if (v > bs) { bs = v; best = b; } });
      if (!best) { delete S.players[id]; return; }
      const t = S.teams[best.team];
      sign40(t, p); p.salary = best.salary; p.contractYears = best.years; delete p.contractNow;
      p.signYear = S.year + 1; p.signAge = p.age;
      const fee = postingFee(best.salary * best.years);
      t.money -= fee; if (t.id === my.id) t.fin.invest += fee;
      I.results.push({ pid: id, name: p.name, to: t.id, text: `${best.years}年・年俸${U.money(best.salary)}・譲渡金${U.money(fee)}` });
      addNews(`ポスティング：${p.amateur.team}の${p.name}が${t.short}と契約（${best.years}年・年俸${U.money(best.salary)}・譲渡金${U.money(fee)}）。`, t.id === my.id ? 'big' : '');
      return;
    }
    // 契約金で取る選手（16 歳・25 歳未満のアジアの選手）。ほかの球団は、評判を見て手を挙げる
    const offers = [];
    S.teams.forEach(t => {
      if (t.id === my.id) return;
      const want = aiDraftValue(p, t.id), bonus = Math.round(p.ask * U.rnd(0.85, 1.15));
      if (bonus <= intlLeft(t) && U.chance(U.clamp((want - 50) / 40, 0.05, 0.6))) offers.push({ team: t.id, bonus });
    });
    if (mine && mine.bonus <= intlLeft(my)) offers.push({ team: my.id, bonus: mine.bonus });
    if (!offers.length) { delete S.players[id]; return; }
    const best = offers.sort((a, b) => b.bonus - a.bonus || Math.random() - 0.5)[0];
    if (best.bonus < p.ask * 0.7) { delete S.players[id]; return; } // 安すぎれば、だれとも契約しない
    const t = S.teams[best.team];
    signPlayer(t, p);
    p.lvl = '1A'; p.signYear = S.year + 1; p.signAge = p.age;
    I.spent[t.id] = intlSpent(t.id) + best.bonus;
    t.money -= best.bonus; if (t.id === my.id) t.fin.invest += best.bonus;
    p.drafted = { year: S.year + 1, round: 0, team: t.short, note: '国際アマ', from: p.amateur ? p.amateur.team : '' };
    if (p.kind === 'アジア') { const fee = Math.round(best.bonus * POST_MINOR_RATE); t.money -= fee; }
    if (t.id === my.id) I.results.push({ pid: id, name: p.name, to: t.id, text: `契約金${U.money(best.bonus)}` });
    if (t.id === my.id) addNews(`国際アマ：${p.name}（${p.nat}・${p.age}歳・${p.isP ? '投手' : p.pos}）と契約金${U.money(best.bonus)}で契約！`, 'good');
    else if (mine) addNews(`申し込んでいた${p.name}は${t.short}と契約しました（契約金${U.money(best.bonus)}）。`, 'bad');
  });
  // 自分の 16 歳の選手は、入団したらドラフトの選手と同じように講評のひとことを残す
  Object.values(S.players).forEach(p => { if (p.noise && p.teamId != null) { p.hint = potHint(p); delete p.noise; delete p.hintRoll; } });
}
// 譲渡金（本物の決まり：契約の総額のうち 2500 万ドルまでは 20%、5000 万ドルまでは 17.5%、その上は 15%）
function postingFee(total) {
  let fee = 0, left = total;
  POST_FEE_TIERS.forEach(([w, r]) => { const x = Math.min(left, w); fee += x * r; left -= x; });
  return Math.round(fee);
}

// ---------- スプリングトレーニング ----------
function offCampStart() {
  offIntlFinish();
  S.teams.forEach(t => {
    if (t.id === S.myTeamId) return;
    // いちばん弱い選手よりはっきり上の自由契約選手がいれば、2 人まで取る（40 人枠に空きがあれば）
    for (let k = 0; k < 2 && count40(t) < FORTY_MAX; k++) {
      const fas = S.freeAgents.map(id => S.players[id]).filter(Boolean);
      const best = fas.sort((a, b) => tradeValue(b) - tradeValue(a)).find(fa => {
        const worst = fortyOf(t).filter(p => p.isP === fa.isP).sort((a, b) => tradeValue(a) - tradeValue(b))[0];
        return worst && tradeValue(fa) > tradeValue(worst) * 1.3 && payroll(t) + fa.salary < MARKETS[t.mk].budget;
      });
      if (!best) break;
      signFreeAgent(t, best, true);
    }
    aiTrim40(t);
    while (t.players.length > ROSTER_MAX) {
      const worst = minorsOf(t).sort((a, b) => tradeValue(a) - tradeValue(b))[0];
      if (!worst) break;
      toFreeAgent(worst);
    }
    fillRoster(t, ROSTER_MIN);
    ai40(t, 6);
  });
  S.off.step = 'camp';
}

// 人数が足りない球団は、自由契約選手からいい選手を取り、いなければマイナー契約の選手を足す
function fillRoster(t, min) {
  let n = 0;
  while (t.players.length < min) {
    const ps = teamPlayers(t);
    const pitchers = ps.filter(p => p.isP).length;
    const isP = pitchers < ps.length - pitchers;
    const fa = S.freeAgents.map(id => S.players[id]).filter(p => p && p.isP === isP && ovr(p) >= 42 && p.salary <= 300).sort((a, b) => tradeValue(b) - tradeValue(a))[0];
    if (fa) signFreeAgent(t, fa, false);
    else { const p = newPlayer(S, { isP, q: U.rnd(32, 46), age: U.rint(19, 26) }); signPlayer(t, p); p.salary = MINOR_PAY; p.signYear = S.year + 1; p.signAge = p.age; p.lvl = '1A'; }
    n++;
  }
  return n;
}

// ---------- 自由契約 ----------
// 自由契約選手と契約できるのは、シーズン中と、オフの FA のあと
function faOpen() {
  if (S.phase === 'off') return !['awards', 'fa'].includes(S.off.step);
  return S.phase === 'season';
}
function releaseOpen() { return S.phase !== 'post'; }

// 自由契約選手の希望年俸：力に見合う額か、前の年俸の 6 割の安いほう
function faDemand(p) {
  const v = Math.min(calcSalary(p) * 0.8, p.salary > MINOR_PAY ? p.salary * 0.6 : Infinity);
  return Math.max(MIN_SALARY, Math.round(v));
}

function toFreeAgent(p) {
  const t = S.teams[p.teamId];
  p.lastTeam = t ? t.short : p.lastTeam;
  removeFromTeam(p);
  p.salary = faDemand(p);
  p.contractYears = 0; delete p.contractNow;
  p.faYears = 0;
  p.inj = 0;
  S.freeAgents.push(p.id);
}

// on40：メジャー契約（40 人枠）で取るか。false ならマイナー契約
function signFreeAgent(t, p, on40) {
  S.freeAgents = S.freeAgents.filter(id => id !== p.id);
  if (on40) sign40(t, p); else { signPlayer(t, p); p.salary = MINOR_PAY; p.lvl = '3A'; }
  p.loyalty = 45; // 拾ってもらった恩
  if (t.id !== S.myTeamId && p.lastTeam === myTeam().short) addNews(`自由契約にした${p.name}が${t.short}と契約しました。`);
}

function signFreeAgentMine(pid, on40) {
  const t = myTeam(), p = S.players[pid];
  if (!faOpen()) return '自由契約選手と契約できるのは、シーズン中と、オフの FA のあとです。';
  if (!p || !S.freeAgents.includes(pid)) return 'その選手はもういません。';
  if (t.players.length >= ROSTER_MAX) return `選手が${ROSTER_MAX}人で一杯です。`;
  if (on40 && count40(t) >= FORTY_MAX) return '40人枠に空きがありません。マイナー契約なら取れます。';
  const fee = Math.round((on40 ? p.salary : MIN_SALARY) * 0.2);
  if (t.money < fee) return 'お金が足りません。';
  t.money -= fee; t.fin.invest += fee;
  const sal = p.salary;
  signFreeAgent(t, p, on40);
  ensureLineup(S, t);
  addNews(`自由契約の${p.name}（${p.isP ? '投手' : p.pos}・${p.age}歳・前${p.lastTeam || '-'}）と${on40 ? `メジャー契約！ 年俸${U.money(sal)}` : 'マイナー契約！'} 契約金${U.money(fee)}`, 'big');
  return null;
}

// 独立リーグなどから、毎年何人か自由契約選手が出てくる
function addIndependentFAs(n) {
  for (let i = 0; i < n; i++) {
    const p = newPlayer(S, { isP: i % 2 === 0, q: U.rnd(42, 56), age: U.rint(24, 32), nat: U.pickW(DRAFT_NAT_W) });
    p.lastTeam = '独立リーグ';
    p.salary = faDemand(p);
    p.faYears = 0;
    p.signYear = S.year - 5; p.signAge = p.age - 5;
    S.freeAgents.push(p.id);
  }
}

// オフに 1 つ歳を取り、年を取りすぎた人・2 年続けて決まらなかった人は引退する
function agingFreeAgents() {
  S.freeAgents = S.freeAgents.filter(id => {
    const p = S.players[id];
    if (!p) return false;
    agePlayer(p);
    p.faYears = (p.faYears || 0) + 1;
    if (careerAge(p) >= 38 || p.faYears >= 2 || ovr(p) < 38) { retireRecord(p); delete S.players[id]; return false; }
    p.salary = faDemand(p);
    return true;
  });
  addIndependentFAs(10);
}

// スプリングトレーニング
function offCampTrain() {
  if (S.off.camped) return;
  S.off.camped = true;
  for (let i = 0; i < 4; i++) weeklyTraining();
  awakenCheck(3); // スプリングトレーニングは覚醒のチャンス
}

function offNewSeason() {
  offCampTrain();
  S.year++;
  startSeason();
}

// ---------- ドラフト（7 月・オールスターの休み。人の言葉 2026-11-20 案7「この案で決める」） ----------
// 候補の出身の割合（高校・大学。仮・AI）
const DRAFT_KINDS = [['高校', 45], ['大学', 55]];
const KIND_BASE = { 高校: 37, 大学: 46, 国際: 26, アジア: 60 }; // 出身ごとの能力の真ん中
// その年のドラフト候補。シーズン開幕のときに発表され、ドラフトまでリストアップできる
function makeDraftClass() {
  const pool = [];
  // 年ごとの当たり外れ（「投手は豊作、野手は不作」のような年ができる）
  const bias = { P: U.clamp(U.gauss() * 3.5, -7, 7), B: U.clamp(U.gauss() * 3.5, -7, 7) };
  for (let i = 0; i < S.teams.length * DRAFT_ROUNDS + 60; i++) {
    const kind = U.pickW(DRAFT_KINDS);
    const age = kind === '高校' ? 18 : U.rint(21, 22);
    const isP = U.chance(0.48);
    const q = (kind === '高校' ? U.rnd(28, 46) : U.rnd(38, 55)) + (isP ? bias.P : bias.B);
    const pot = U.clamp(0.97 + U.gauss() * 0.24 + (kind === '高校' ? 0.08 : 0), 0.6, 1.7);
    const p = newPlayer(S, { isP, q, age, pot, nat: U.pickW(DRAFT_NAT_W) });
    p.kind = kind;
    p.salary = MINOR_PAY;
    if (p.isP && p.pot >= 1.1 && U.chance(TWO_WAY_CHANCE / 0.2)) {
      PIT_KEYS.forEach(k => { p.a[k] = Math.min(abilMax(p, k), p.a[k] + 6); });
      pitchesOf(p).forEach(t => abilSet(p, t, Math.min(abilMax(p, t), abilGet(p, t) + 6)));
      makeTwoWay(p, q + 4);
    }
    finishProspect(p, kind);
    pool.push(p.id);
  }
  return pool;
}

// 候補の仕上げ：スカウトの見立てのずれ・アマチュアの成績・「〇年に一人」
function finishProspect(p, kind) {
  // 能力ごとの「ずれの向きと大きさ」（-1〜1）を先に決めておく。実際のずれはスカウトの段階で小さくなる
  const miss = () => ({ unit: U.clamp(U.gauss() * 0.5, -1, 1) });
  p.noise = {};
  abilKeys(p).forEach(k => { p.noise[k] = miss(); });
  if (canPitch(p)) p.noise.kire = miss(); // 球のキレ
  p.noise.pot = miss();
  p.noise.rep = U.clamp(U.gauss(), -2.5, 2.5); // 才能の評判のずれ（-1〜1 で REP_SD ぶん）
  p.amateur = makeAmateur(p, kind);
  const ry = kind === '国際' ? 0 : rareYears(p);
  if (ry) p.rareYears = ry;
}

const KIND_WORD = { 高校: '高校生', 大学: '大学生', 国際: '16歳', アジア: 'アジアのプロ' };
// ドラフト候補の発表で、「〇年に一人の逸材」をニュースにする
function announceDraftClass() {
  S.draftClass.map(id => S.players[id]).filter(p => p.rareYears).forEach(p => {
    addNews(`今年のドラフト候補に「${p.rareYears}年に一人の逸材」と言われる${KIND_WORD[p.kind]}がいる！ ${p.name}（${p.amateur ? p.amateur.team : p.kind}）`, 'big');
  });
}

// 「〇年に一人の逸材」：本当の能力と才能が、何年に 1 人しか出ない高さか
function rareYears(p) {
  const v = draftValue(p) + (p.genius ? 8 : 0);
  const hit = RARE_PROSPECT.find(r => v >= r[0]);
  return hit ? hit[1] : 0;
}
function rareTag(p) { return p.rareYears ? `<span class="tag rare">${p.rareYears}年に一人の逸材</span>` : ''; }

// ドラフト会議を始める。順番は去年の成績とロッタリーで決めたもの。補償・ぜいたく税・失った指名権をここで入れる
function draftStart() {
  const pool = (S.draftClass || makeDraftClass()).filter(id => S.players[id]);
  S.draftClass = null;
  const base = S.draftNext && S.draftNext.year === S.year ? S.draftNext.order.slice() : sortTeams(S.teams).reverse().map(t => t.id);
  const pt = (S.pickTrades || []).filter(x => x.year === S.year);
  const dropped = pt.filter(x => x.kind === 'drop').map(x => x.team);
  const picks = [];
  for (let r = 1; r <= DRAFT_ROUNDS; r++) {
    const order = base.slice();
    if (r === 1) dropped.forEach(tid => { const i = order.indexOf(tid); if (i >= 0) { order.splice(i, 1); order.splice(Math.min(order.length, i + LUX_PICK_DROP), 0, tid); } });
    order.forEach(tid => {
      const lost = pt.find(x => x.kind === 'lose' && x.team === tid && x.round === r && !x.used);
      if (lost) { lost.used = true; return; } // 失った指名権
      picks.push({ team: tid, round: r, note: r === 1 && dropped.includes(tid) ? `ぜいたく税で${LUX_PICK_DROP}番下がった` : '' });
    });
    if (r === 1) pt.filter(x => x.kind === 'comp').forEach(x => picks.push({ team: x.team, round: 1, note: `補償（${x.name}）` }));
    pt.filter(x => x.kind === 'extra' && x.round === r).forEach(x => picks.push({ team: x.team, round: r, note: `去年断られた分（${x.name}）` }));
  }
  picks.forEach((x, i) => { x.no = i + 1; x.slot = slotValue(i + 1); });
  S.pickTrades = (S.pickTrades || []).filter(x => x.year > S.year);
  S.draft = { year: S.year, pool, picks, idx: 0, result: [], myDone: false, stage: 'pick', finished: false, bonus: {}, lottery: S.draftNext && S.draftNext.year === S.year ? S.draftNext.lottery : [] };
  draftRunAI();
  addNews(`${S.year}年のドラフト会議が始まりました（${DRAFT_ROUNDS}巡目まで・全${picks.length}人）。「ドラフト」の画面で指名してください。`, 'big');
}
// その球団の契約金の枠（1〜10 巡目の目安の合計）
function draftPoolOf(tid) { return U.sum(S.draft.picks.filter(x => x.team === tid), x => x.slot); }
function draftRound() { const D = S.draft, x = D.picks[D.idx]; return x ? x.round : DRAFT_ROUNDS; }
function draftDone() { const D = S.draft; return !!D && D.idx >= D.picks.length; }

// スカウトの段階ごとの、見立てのずれの最大（能力の数字）。段階を上げるほど小さくなる
const SCOUT_RANGE = [0, 15, 10, 6, 3, 1];
function scoutRange() { return SCOUT_RANGE[myTeam().fac.scout]; }

// どの能力も少しずつずれて見える。ずれの大きさはスカウトの段階で決まる
function scoutView(p, key) {
  const n = p.noise && p.noise[key];
  const real = key === 'pot' ? p.pot : key === 'kire' ? pitchPower(p) : p.a[key];
  if (!n || typeof n !== 'object') return real;
  const unit = n.unit || 0;
  const dev = unit * scoutRange();
  if (key === 'pot') return U.clamp(real + repOff(p) * SCOUT_REP_W[myTeam().fac.scout] + unit * scoutRange() * POT_SEEN_MUL, 0.5, 1.75); // 評判に引っぱられ、スカウトを上げるほど本当に近づく
  return U.clamp(real + dev, 1, key === 'velo' ? VELO_MAX : ABIL_MAX);
}

// ---------- ドラフトの評価（スカウトの見立てで決めるので、スカウトが低いと外れることもある） ----------
function seenOvr(p) { return ovr({ ...p, a: Object.fromEntries(Object.keys(p.a).map(k => [k, scoutView(p, k)])), pvSeen: canPitch(p) ? scoutView(p, 'kire') : undefined }); }
function draftScore(p) { return scoutView(p, 'pot') * 40 + seenOvr(p) * 0.6; }
// ふつうの年に「目玉 3 人・1 位級 12 人・上位 36 人」くらいになる点（元のペナント監督の線のまま・仮・AI）
const DRAFT_TIERS = [
  [94, '全体1位候補の目玉', 1], [84, '1巡目上位の逸材', 2], [76, '1巡目で消える', 3],
  [67, '2〜4巡目候補', 4], [58, '5〜10巡目候補', 5], [-Infinity, '指名漏れもありうる', 6],
];
const DRAFT_TOP = 76; // 「上位候補」とみなす点
// 上位候補の人数が この数以下なら「不作」、以上なら「豊作」
const REVIEW_LINE = { P: [14, 21], B: [16, 25] };
function draftTier(p) { const s = draftScore(p); return DRAFT_TIERS.find(t => s >= t[0]); }

function toggleWatch(pid) {
  if (!S.watch) S.watch = [];
  const i = S.watch.indexOf(pid);
  if (i >= 0) S.watch.splice(i, 1); else S.watch.push(pid);
}

// ---------- アマチュア時代の成績と講評 ----------
const COLLEGE_LEAGUES = ['パシフィックコースト大学リーグ', 'グレートプレーンズ大学リーグ', 'アトランティック大学リーグ', 'ミッドウェスト大学リーグ', 'サザン大学リーグ', 'ノースイースト大学リーグ']; // 架空（仮・AI）
// 成績とタイトルは本当の能力から作る（スカウトの見立てとは別の、表に出ている事実）
function makeAmateur(p, kind) {
  const base = KIND_BASE[kind] || 40;
  const z = v => U.clamp((v - base) / 9 + U.gauss() * 0.35, -2.5, 3);
  const n0 = v => Math.max(0, Math.round(v));
  const avg = v => U.avg(v * 1000, 1000);
  const era = v => U.clamp(v, 0.3, 6).toFixed(2);
  const A = { kind, team: '', line: '', title: '' };
  let league = '';
  if (kind === '高校') A.team = `${U.pick(['セントラル', 'ノース', 'サウス', 'イースト', 'ウエスト', 'リバーサイド', 'レイクビュー', 'ヒルクレスト', 'オークリッジ', 'マウンテンビュー'])}高校（${p.home}）`;
  else if (kind === '大学') { league = U.pick(COLLEGE_LEAGUES); A.team = `${U.pick(['ステート', 'テック', 'セントラル', 'パシフィック', 'サザン', 'ノーザン', 'コースタル', 'ミッドランド'])}大学（${league}）`; }
  else A.team = `${p.nat}の${U.pick(['野球アカデミー', 'トレーニング施設', '少年リーグ'])}`;
  const km = veloKmh(p.isP ? p.a.velo : 0) + U.rint(1, 3);
  if (!p.isP) {
    const zm = z(p.a.meet), zp = z(p.a.power), zs = z(p.a.speed);
    const all = (zm + zp + zs) / 3;
    if (kind === '高校') {
      A.line = `高校通算 ${n0(14 + 11 * zp + U.gauss() * 4)}本塁打 ・ 打率${avg(U.clamp(0.38 + 0.045 * zm + U.gauss() * 0.02, 0.22, 0.58))} ・ ${n0(12 + 8 * zs)}盗塁`;
      if (all > 0.3 && U.chance(0.6)) A.title = U.chance(0.5) ? '州の年間最優秀選手' : '全米高校代表';
    } else if (kind === '大学') {
      A.line = `大学通算 ${U.rint(150, 190)}試合 打率${avg(U.clamp(0.3 + 0.035 * zm + U.gauss() * 0.015, 0.2, 0.44))} ・ ${n0(18 + 9 * zp + U.gauss() * 3)}本塁打 ・ ${n0(15 + 9 * zs + U.gauss() * 3)}盗塁`;
      if (zm > 1.1) A.title = `${league}で首位打者`;
      else if (zp > 1.1) A.title = `${league}で本塁打王`;
      else if (zs > 1.2) A.title = `${league}で盗塁王`;
      else if (all > 0.6 && U.chance(0.5)) A.title = 'サマーリーグで活躍';
    } else {
      A.line = `打撃練習の打球の速さが${zp > 0.8 ? '同じ年でいちばん' : zp > 0 ? '同じ年の上のほう' : 'ふつう'} ・ 足は${zs > 0.8 ? 'とても速い' : zs > 0 ? '速め' : 'ふつう'}`;
      if (all > 0.6 && U.chance(0.5)) A.title = 'ショーケースで注目を集めた';
    }
  } else {
    const kire = pitchPower(p), zq = z((p.a.velo + p.a.control + kire) / 3), zk = z((p.a.velo + kire) / 2);
    if (kind === '高校') {
      A.line = `最速${km}km/h ・ 最後の年の防御率${era(1.4 - 0.4 * zq + U.gauss() * 0.3)}`;
      if (zq > 0.3 && U.chance(0.6)) A.title = U.chance(0.5) ? '州の年間最優秀投手' : '全米高校代表';
    } else if (kind === '大学') {
      A.line = `大学通算 ${n0(18 + 6 * zq + U.gauss() * 2)}勝${n0(10 - 3 * zq + U.gauss() * 2)}敗 防御率${era(3.2 - 0.5 * zq + U.gauss() * 0.3)} ・ ${n0(190 + 55 * zk + U.gauss() * 15)}奪三振 ・ 最速${km}km/h`;
      if (zq > 1.1) A.title = `${league}で最優秀防御率`;
      else if (zk > 1.1) A.title = `${league}で最多奪三振`;
      else if (zq > 0.6 && U.chance(0.5)) A.title = 'サマーリーグで活躍';
    } else {
      A.line = `最速${km}km/h（16歳）`;
      if (zq > 0.6 && U.chance(0.5)) A.title = 'ショーケースで注目を集めた';
    }
    if (p.twoWay) A.line += ` ／ 打っては 打率${avg(U.clamp(0.3 + 0.04 * z(p.a.meet), 0.2, 0.5))}・${n0(4 + 6 * z(p.a.power))}本塁打`;
  }
  return A;
}

const SCOUT_GOOD = {
  meet: '確実性が高く広角に打てる', power: 'スイングが速く長打力が魅力', speed: '一塁到達の速い俊足', arm: '強肩で送球が正確', field: '守備範囲が広い',
  velo: '威力のある直球が武器', control: '制球が良く四球が少ない', stamina: '長いイニングを投げられるスタミナ', kire: 'キレのある変化球',
};
const SCOUT_BAD = {
  meet: '確実性に課題', power: '長打は少なめ', speed: '足は速くない', arm: '送球に不安', field: '守備に課題',
  velo: '球速はもう一つ', control: '制球にばらつき', stamina: 'スタミナに課題', kire: '変化球の精度が課題',
};

// スカウトの講評。見立て（scoutView）で書くので、スカウトが低いと外れていることもある
function scoutComment(p) {
  const keys = [...abilKeys(p), ...(canPitch(p) ? ['kire'] : [])].sort((a, b) => scoutView(p, b) - scoutView(p, a));
  const best = keys[0], worst = keys[keys.length - 1];
  const base = KIND_BASE[p.kind] || 45;
  const parts = [SCOUT_GOOD[best]];
  if (scoutView(p, keys[1]) >= base + 8) parts.push(SCOUT_GOOD[keys[1]]);
  if (scoutView(p, worst) < base) parts.push(SCOUT_BAD[worst]);
  const pot = scoutView(p, 'pot');
  if (canBat(p) && trajOf(p) === 4) parts.push('打球が高く上がるアーチスト');
  else if (canBat(p) && trajOf(p) === 1) parts.push('低く鋭い打球のライナー打者');
  const hint = potHint(p);
  if (hint) parts.push(hint);
  if (p.kind === '高校' && pot >= 1.15 && ovr(p) < 38) parts.push('じっくり育てたい素材型');
  if (p.kind === '大学' && ovr(p) >= 52) parts.push('メジャーまでの距離は近い');
  if (p.kind === '国際') parts.push('体ができれば、まだまだ変わる');
  if (p.twoWay) parts.push('投打の二刀流');
  return parts.join('。') + '。';
}

// 天才の気配に気づくか。スカウトの段階が高いほど本物に気づき、低いと見間違えることもある
const GENIUS_NOTICE = [0, 0.25, 0.4, 0.55, 0.75, 0.95];
function geniusHint(p) {
  const lv = myTeam().fac.scout;
  if (p.geniusRoll == null) p.geniusRoll = Math.random();
  if (p.genius) return p.geniusRoll < GENIUS_NOTICE[lv];
  return p.geniusRoll < (5 - lv) * 0.005; // 見間違い
}

function draftValue(p) { return ovr(p) * 0.6 + p.pot * 40 + (p.age <= 18 ? 5 : 0); }
// ほかの球団が見る値。才能はスカウトの見立てでずれる（どの球団も同じ向きの分＋球団ごとの分）
function teamNoise(pid, tid) { const x = Math.sin(pid * 12.9898 + tid * 78.233) * 43758.5453; return ((x - Math.floor(x)) * 2 - 1) * 1.7; } // 球団と選手で決まる -1.7〜1.7（ばらつき 1 ぐらい）
// 評判と本当の才能の差
function repOff(p) { const n = p.noise || {}; return (n.rep || 0) * REP_SD; }
function aiDraftValue(p, tid) {
  const seen = p.pot + repOff(p) * AI_SCOUT_POT[0] + teamNoise(p.id, tid) * AI_SCOUT_POT[1];
  return ovr(p) * 0.6 + seen * 40 + (p.age <= 18 ? 5 : 0);
}
// 入団してまもない選手の才能。毎年オフに少し動き、まれに大きく伸びる
function potDrift(p) {
  if (!p.drafted || S.year - p.drafted.year >= POT_DRIFT_YEARS) return;
  const bloom = U.chance(LATE_BLOOM[0]);
  p.pot = U.clamp(p.pot + U.gauss() * POT_DRIFT_SD + (bloom ? LATE_BLOOM[1] : 0), 0.6, 1.75);
  if (bloom && p.teamId === S.myTeamId) addNews(`${p.name}が一皮むけた様子です。コーチ陣は「伸びしろがまだまだある」と話しています。`, 'good');
}
// 才能の★を隠すか。ドラフト候補と、入団してまもない選手
function potHidden(p) {
  if (p.noise) return true; // ドラフト候補
  return !!p.drafted && S.year - p.drafted.year < POT_CLEAR_YEARS;
}
// 才能のありそうな選手への、講評のひとこと。見立て（スカウトの段階でずれる）で決めるので、外れることもある。出ない選手もいる
function potHint(p) {
  if (p.hint != null) return p.hint; // 入団したら、ドラフトのときのひとことのまま
  if (p.hintRoll == null) p.hintRoll = Math.random();
  const pot = scoutView(p, 'pot'), r = p.hintRoll;
  if (pot >= POT_HINT[0] && r < POT_HINT[1]) {
    const where = p.kind === '高校' ? '高校の4年間' : p.kind === '大学' ? '大学の3年間' : 'この1年';
    const km = Math.round(6 + (pot - POT_HINT[0]) * 25 + r * 8);
    const list = [
      canPitch(p) ? `${where}で球速を${km}km上げた` : `${where}で本塁打の数を毎年増やしてきた`,
      'まだ体が細く、伸びしろがある',
      '野球を本格的に始めたのが遅く、まだまだ伸びそう',
      '練習の虫で、指導者も「まだまだ伸びる」と話す',
    ];
    if (pot >= 1.42) list.push('将来のスター候補との声も');
    return list[Math.floor(r / POT_HINT[1] * list.length)];
  }
  if (pot < 0.85 && r < 0.4) return '完成度は高いが、伸びしろは小さめ';
  return '';
}

// 指名した選手を球団に入れる（マイナー契約。契約金はドラフトのあとで決める）
function assignPick(x, pid) {
  const D = S.draft;
  const p = S.players[pid], t = S.teams[x.team];
  D.pool = D.pool.filter(id => id !== pid);
  signPlayer(t, p);
  p.salary = MINOR_PAY;
  p.lvl = p.kind === '高校' ? '1A' : ovr(p) >= 48 ? '2A' : '1A';
  p.loyalty = U.rint(55, 75);
  p.svc = 0;
  p.signYear = S.year; p.signAge = p.age;
  // 何年のドラフトの何巡目で、どの球団に入ったか（選手の詳細に出す）
  p.drafted = { year: S.year, round: x.round, no: x.no, team: t.short, note: x.note || '', from: p.amateur ? p.amateur.team : '' };
  D.result.push({ round: x.round, no: x.no, team: x.team, pid, name: p.name, pos: p.pos, kind: p.kind, note: x.note || '', slot: x.slot });
  if (x.team === S.myTeamId) addNews(`ドラフト${x.round}巡目（全体${x.no}番）で${p.name}（${KIND_WORD[p.kind]}・${p.isP ? '投手' : p.pos}）を指名！`, 'good');
  else if ((S.watch || []).includes(pid)) addNews(`気になっていた${p.name}は${t.short}が${x.round}巡目（全体${x.no}番）で指名しました。`, 'bad');
}

function draftRunAI() {
  const D = S.draft;
  while (D.idx < D.picks.length) {
    const x = D.picks[D.idx];
    if (x.team === S.myTeamId && !D.myDone) break;
    if (x.team !== S.myTeamId) {
      const best = D.pool.map(id => S.players[id]).sort((a, b) => aiDraftValue(b, x.team) - aiDraftValue(a, x.team))[0];
      if (best) assignPick(x, best.id);
    }
    D.idx++; // 選択終了したあとの自分の番は飛ばす
  }
  if (D.idx >= D.picks.length && D.stage === 'pick') D.stage = 'sign';
}

function draftMyPick(pid) {
  const D = S.draft, x = D.picks[D.idx];
  if (!x || x.team !== S.myTeamId || !D.pool.includes(pid)) return;
  assignPick(x, pid);
  D.idx++;
  draftRunAI();
}

// 選択終了：このあとは指名しない
function draftPass() {
  S.draft.myDone = true;
  draftRunAI();
}

// 断る見込み。高校生は大学へ進むことがある。目安より高い契約金なら断りにくく、安いと断られやすい（仮・AI）
function refuseChance(p, round, ratio) {
  const base = p.kind === '高校' ? HS_REFUSE.find(([r]) => round <= r)[1] : COLLEGE_REFUSE;
  return U.clamp(base * (ratio >= 1 ? 1 / (1 + (ratio - 1) * 4) : 1 + (1 - ratio) * 3), 0.01, 0.95);
}
// 契約金を決めて、契約を締め切る。断られた指名は、翌年の同じ巡目に 1 つ指名権がもらえる
function draftSignAll() {
  const D = S.draft;
  if (!D || D.stage !== 'sign') return;
  const my = myTeam();
  let spent = 0;
  const pool = draftPoolOf(my.id);
  D.result.forEach(r => {
    const p = S.players[r.pid];
    if (!p || p.teamId !== r.team) return;
    const t = S.teams[r.team], mine = t.id === my.id;
    const bonus = mine ? Math.max(1, Math.round(D.bonus[r.pid] != null ? D.bonus[r.pid] : r.slot)) : r.slot;
    if (U.chance(refuseChance(p, r.round, bonus / r.slot))) {
      r.refused = true;
      removeFromTeam(p);
      delete S.players[p.id];
      S.pickTrades.push({ year: S.year + 1, kind: 'extra', round: r.round, team: t.id, name: r.name });
      if (mine) addNews(`${r.round}巡目の${r.name}は契約を断り、大学へ進みました。来年の${r.round}巡目に指名権が 1 つ増えます。`, 'bad');
      return;
    }
    r.bonus = bonus;
    t.money -= bonus;
    if (mine) { t.fin.invest += bonus; spent += bonus; }
  });
  // 契約金の枠を 5% より多く超えたら、超えた分に税、翌年の 1 巡目を失う
  if (spent > pool * (1 + DRAFT_POOL_OVER)) {
    const tax = Math.round((spent - pool) * DRAFT_TAX);
    my.money -= tax; my.fin.invest += tax;
    S.pickTrades.push({ year: S.year + 1, kind: 'lose', round: 1, team: my.id, name: '契約金の枠を超えた' });
    addNews(`ドラフトの契約金が枠（${U.money(pool)}）を ${U.money(spent - pool)} 超えたので、税 ${U.money(tax)} を払い、来年の 1 巡目の指名権を失いました。`, 'bad');
  }
  D.spent = spent; D.poolMine = pool;
  draftFinish();
}

// ---------- ドラフト採点（スカウト部長の見立て） ----------
// 指名した選手の評価の点（draftScore）を、良い順に重みを付けて足す。上位の選手ほど重く見る
const PICK_W = [1, 0.8, 0.65, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1];
// 30 球団の中の順位で A〜E を付ける（A 5 球団・B 7・C 8・D 6・E 4）
const GRADE_BY_RANK = [...'AAAAABBBBBBBCCCCCCCCDDDDDDEEEE'];
function gradeByRank(rows, key) {
  rows.slice().sort((a, b) => b[key] - a[key]).forEach((r, i) => { r.grade = GRADE_BY_RANK[Math.min(i, GRADE_BY_RANK.length - 1)]; });
  return rows;
}

function draftGrades(D) {
  const rows = S.teams.map(t => {
    const picks = D.result.filter(r => r.team === t.id && !r.refused).sort((a, b) => a.no - b.no);
    const ps = picks.map(r => S.players[r.pid]).filter(Boolean);
    const scored = ps.map(p => ({ p, s: draftScore(p) })).sort((a, b) => b.s - a.s);
    const pts = scored.reduce((sum, x, i) => sum + x.s * (PICK_W[i] || 0.1), 0);
    // ひとこと
    const notes = [];
    if (scored[0]) notes.push(`目玉は${scored[0].p.name}（${draftTier(scored[0].p)[1]}）`);
    const hs = ps.filter(p => p.kind === '高校').length, ready = ps.filter(p => p.kind !== '高校' && seenOvr(p) >= 54).length;
    if (ps.length && hs >= Math.ceil(ps.length / 2)) notes.push('高校生中心で将来性重視');
    else if (ready >= 3) notes.push('メジャーに近い大学生を厚く');
    if (picks.length <= 4) notes.push(`${picks.length}人で選択終了`);
    return { id: t.id, pts: Math.round(pts), picks: picks.map(r => r.pid), n: picks.length, note: notes.join('・') };
  });
  return gradeByRank(rows, 'pts');
}

// その年のドラフトの「いま」：指名した選手が今どれくらいの選手になっているか（答え合わせ）
function draftNow(h) {
  const rows = h.rows.map(r => {
    const ps = r.picks.map(id => S.players[id]).filter(p => p && (p.teamId != null || S.freeAgents.includes(p.id)));
    const ovrs = ps.map(p => ovr(p)).sort((a, b) => b - a);
    const nowPts = ovrs.slice(0, 3).reduce((s, v, i) => s + v * [1, 0.7, 0.5][i], 0);
    const best = ps.slice().sort((a, b) => ovr(b) - ovr(a))[0];
    const titles = ps.reduce((s, p) => s + titlesOf(p.id).length, 0);
    return { id: r.id, was: r.grade, alive: ps.length, n: r.picks.length, best, titles, nowPts: nowPts + titles * 3 };
  });
  return gradeByRank(rows, 'nowPts');
}

// ドラフトを締める
function draftFinish() {
  const D = S.draft;
  if (!D || D.finished) return;
  D.finished = true;
  D.stage = 'done';
  // ドラフト採点を残す（スカウトの見立てが消える前に）
  const grades = draftGrades(D);
  if (!S.draftHist) S.draftHist = [];
  S.draftHist.unshift({ year: S.year, rows: grades.map(r => ({ id: r.id, grade: r.grade, pts: r.pts, picks: r.picks, note: r.note })) });
  D.grades = grades.map(r => ({ id: r.id, grade: r.grade, pts: r.pts, n: r.n, note: r.note, picks: r.picks }));
  const mineG = grades.find(r => r.id === S.myTeamId);
  if (mineG) addNews(`ドラフト採点：${myTeam().short}は「${mineG.grade}」（${mineG.note || '指名なし'}）`, mineG.grade === 'A' ? 'good' : mineG.grade === 'E' ? 'bad' : '');
  // 指名されなかった候補は消える
  D.pool.forEach(id => delete S.players[id]);
  D.pool = [];
  // 入団した選手は、ドラフトのときの講評のひとことを残す（才能の★が出るまで、選手の画面に出す）
  Object.values(S.players).forEach(p => { if (p.noise && p.drafted) p.hint = potHint(p); if (p.drafted || p.teamId != null) { delete p.noise; delete p.hintRoll; } });
  S.teams.forEach(t => { if (t.id !== S.myTeamId) assignLevels(t); });
}

// ---------- トレード・補強 ----------
function tradeOpen() {
  if (S.phase === 'off') return ['contract', 'arb', 'intl', 'camp'].includes(S.off.step);
  if (S.phase !== 'season') return false;
  return S.schedule[Math.min(S.day, S.schedule.length - 1)].m <= TRADE_DEADLINE_MONTH;
}

// お金をトレード価値に直す（選手とお金をまぜたトレード）
function cashValue(cash) { return Math.round(Math.abs(cash || 0) / CASH_PER_VALUE); }
// 総合の力に見合う年俸（calcSalary と同じ式）
function salOfOvr(o) { return realSal(500 + Math.pow(Math.max(0, o - 46), 2.5) * 3); }
// お金だけで売り買いするときの値段（万円）。球団は本当の才能を知っている
function cashPrice(p) {
  const o = ovr(p), ca = careerAge(p);
  const ageMul = CASH_AGE_MUL.find(x => ca <= x[0])[1];
  let price = salOfOvr(o) * ageMul;
  const gf = CASH_GROW_F.find(x => ca <= x[0]);
  if (gf && growthPhase(p).k !== 'decline') {
    const ceil = CEIL_BASE + p.pot * CEIL_PER_POT + (p.genius ? 10 : 0);
    const fut = o + Math.max(0, ceil - o) * gf[1];
    price += (salOfOvr(fut) - salOfOvr(o)) * CASH_GROW_MUL;
  }
  return Math.max(MIN_SALARY, Math.round(price));
}
// お金だけのトレードなら、出す側から見た「釣り合い」（1 で値段どおり）。選手どうしのトレードなら null
function cashTradeRatio(give, get, cash) {
  if (!give.length && get.length && cash > 0) return cash / U.sum(get, cashPrice);
  if (give.length && !get.length && cash < 0) return U.sum(give, cashPrice) / -cash;
  return null;
}

// 相手チームの主力（総合で上から TRADE_CORE_N 人）
function tradeCore(t) { return teamPlayers(t).sort((a, b) => ovr(b) - ovr(a)).slice(0, TRADE_CORE_N).map(p => p.id); }

// cash：こちらが払うお金（万円）。マイナスならこちらがもらう
function proposeTrade(otherId, giveIds, getIds, cash = 0) {
  const me = myTeam(), other = S.teams[otherId];
  const give = giveIds.map(id => S.players[id]), get = getIds.map(id => S.players[id]);
  if (!give.length && !get.length) return { ok: false, msg: '選手を選んでください。' };
  if (cash > 0 && me.money < cash) return { ok: false, msg: 'お金が足りません。' };
  if (cash < 0 && other.money < -cash) return { ok: false, msg: `${other.short}「そんなお金はありませんよ。」` };
  if (!give.length && cash > 0) {
    const core = tradeCore(other);
    if (get.some(p => core.includes(p.id))) return { ok: false, msg: `${other.short}「主力をお金で手放すことはできません。」` };
  }
  const rosterErr = tradeRosterError(other, give, get);
  if (rosterErr) return { ok: false, msg: rosterErr };
  if (give.length && !get.length && cash <= 0) {
    const err = freeTradeError(other, give);
    if (err) return { ok: false, msg: err };
  }
  const vGive = U.sum(give, tradeValue) + (cash > 0 ? cashValue(cash) : 0), vGet = U.sum(get, tradeValue) + (cash < 0 ? cashValue(cash) : 0);
  const cr = cashTradeRatio(give, get, cash);
  if (cr != null ? cr < 1.08 : vGive < vGet * 1.08) return { ok: false, msg: `${other.short}「その条件では受けられませんね。」` };
  doTrade(other, give, get, cash);
  return { ok: true, msg: 'トレード成立！' };
}

// 人数の決まりに合わないときは、その理由を返す
function tradeRosterError(other, give, get) {
  const me = myTeam();
  if (me.players.length - give.length + get.length > ROSTER_MAX) return `こちらの人数が${ROSTER_MAX}人を超えます。`;
  if (other.players.length - get.length + give.length > ROSTER_MAX) return `相手の人数が${ROSTER_MAX}人を超えます。`;
  const n40 = ps => ps.filter(p => p.on40).length;
  if (count40(me) - n40(give) + n40(get) > FORTY_MAX) return `こちらの40人枠が${FORTY_MAX}人を超えます（先にだれかを40人枠から外してください）。`;
  const count = (t, out, inn, isP) => teamPlayers(t).filter(p => p.isP === isP).length
    - out.filter(p => p.isP === isP).length + inn.filter(p => p.isP === isP).length;
  if (count(other, get, give, false) < 12 || count(other, get, give, true) < 11) return '相手の選手が足りなくなるので断られました。';
  if (count(me, give, get, false) < 10 || count(me, give, get, true) < 8) return 'こちらの選手が足りなくなります。';
  return null;
}

// 無償で譲るとき、相手が引き取らない理由。年俸が高すぎる選手と、相手のいちばん下の選手より力が劣る選手は断られる（お金を付ければ受ける）
function freeTradeError(other, give) {
  for (const p of give) {
    if (p.salary > calcSalary(p) * FREE_TRADE_SALARY) return `${other.short}「${p.name}のその年俸では、無償でも引き取れません。」`;
    const same = teamPlayers(other).filter(q => q.isP === p.isP);
    if (same.length && ovr(p) < Math.min(...same.map(ovr))) return `${other.short}「${p.name}は、うちでは使いどころがありません。」`;
  }
  return null;
}

// トレードを成立させる。cash：こちらが払うお金（万円）。マイナスならこちらがもらう
function doTrade(other, give, get, cash) {
  const me = myTeam();
  if (cash > 0) { me.money -= cash; me.fin.invest += cash; other.money += cash; other.fin.other += cash; }
  if (cash < 0) { me.money -= cash; me.fin.other -= cash; other.money += cash; other.fin.invest -= cash; }
  // 40 人枠の選手は 40 人枠のまま、マイナー契約の選手はマイナーのまま移る。ルール 5 の選手は、移った先でも 26 人枠に置く決まりが続く
  const move = (p, to) => { const was40 = p.on40, r5 = p.r5; removeFromTeam(p); signPlayer(to, p); if (was40) add40(p); else p.salary = Math.min(p.salary, MINOR_PAY) || MINOR_PAY; p.lvl = '3A'; if (r5) p.r5 = { ...r5, to: to.id }; p.loyalty = 20; };
  give.forEach(p => move(p, other));
  get.forEach(p => move(p, me));
  aiTrim40(other); autoActive(other); autoLineup(other); autoRotation(other); assignLevels(other);
  ensureLineup(S, me);
  const side = (ps, c) => [ps.map(p => p.name).join('・'), c > 0 ? `金銭${U.money(c)}` : ''].filter(Boolean).join('＋') || 'なし';
  const word = cash ? '金銭' : !give.length || !get.length ? '無償' : '';
  addNews(`${word}トレード成立！ ${side(give, cash)} ⇔ ${side(get, -cash)}（${other.short}）`, 'big');
}

// ---------- 相手からのトレードの話 ----------
// S.tradeOffers：{ kind: 'want'（こちらの選手がほしい）/ 'free'（無償で譲りたい）, team, give, get, cash, w（返事の期限・週） }
function tradeOfferValid(o) {
  const other = S.teams[o.team];
  const give = o.give.map(id => S.players[id]), get = o.get.map(id => S.players[id]);
  if (give.some(p => !p || p.teamId !== S.myTeamId) || get.some(p => !p || p.teamId !== o.team)) return false;
  if (o.cash < 0 && other.money < -o.cash) return false;
  return !tradeRosterError(other, give, get);
}

function tradeOffers() {
  S.tradeOffers = (S.tradeOffers || []).filter(tradeOfferValid);
  return S.tradeOffers;
}

// 毎週：期限を進めて、ときどき新しい話が来る
function tradeOfferTick() {
  if (!tradeOpen()) { S.tradeOffers = []; return; }
  S.tradeOffers = (S.tradeOffers || []).filter(o => --o.w > 0);
  tradeOfferRoll();
}

function tradeOfferRoll() {
  if (!tradeOpen() || tradeOffers().length >= TRADE_OFFER_MAX || !U.chance(TRADE_OFFER_CHANCE)) return;
  const t = U.pick(S.teams.filter(x => x.id !== S.myTeamId));
  const o = U.chance(TRADE_OFFER_FREE) ? makeFreeOffer(t) : makeWantOffer(t);
  if (!o || !tradeOfferValid(o)) return;
  S.tradeOffers.push(o);
  addNews(`${t.short}からトレードの話が来ました。トレードの画面で返事ができます。`, 'good');
}

// 無償で譲りたい：主力ではない 29 歳以上の選手
function makeFreeOffer(t) {
  const core = tradeCore(t);
  const cands = teamPlayers(t).filter(p => p.age >= 29 && ovr(p) >= 50 && !core.includes(p.id));
  if (!cands.length) return null;
  return { kind: 'free', team: t.id, give: [], get: [U.pick(cands).id], cash: 0, w: TRADE_OFFER_WEEKS };
}

// こちらの選手がほしい（看板の 3 人には声をかけない）：見合う選手か、少し多めのお金を出す
function makeWantOffer(t) {
  const mine = teamPlayers(myTeam()).sort((a, b) => tradeValue(b) - tradeValue(a)).slice(3, 25);
  if (!mine.length) return null;
  const p = U.pick(mine), v = tradeValue(p);
  const core = tradeCore(t);
  const swaps = teamPlayers(t).filter(q => q.isP === p.isP && !core.includes(q.id) && tradeValue(q) >= v * 1.05 && tradeValue(q) <= v * 1.4);
  if (swaps.length && U.chance(0.5)) return { kind: 'want', team: t.id, give: [p.id], get: [U.pick(swaps).id], cash: 0, w: TRADE_OFFER_WEEKS };
  const cash = Math.round(cashPrice(p) * U.rnd(1.1, 1.4));
  if (cash <= 0 || t.money < cash) return null;
  return { kind: 'want', team: t.id, give: [p.id], get: [], cash: -cash, w: TRADE_OFFER_WEEKS };
}

// 返事をする。受けたら true、受けられなかったら理由の文字列
function answerTradeOffer(i, yes) {
  const list = tradeOffers(), o = list[i];
  if (!o) return 'その話はもうありません。';
  list.splice(i, 1);
  if (!yes) { addNews(`${S.teams[o.team].short}からのトレードの話を断りました。`); return true; }
  doTrade(S.teams[o.team], o.give.map(id => S.players[id]), o.get.map(id => S.players[id]), o.cash);
  return true;
}

// 40 人枠から外す（DFA）。ウェーバーにかけ、ほかの球団が取らなければ、マイナー契約で残る（人の言葉 2026-11-20 案4）
function dfaPlayer(pid) {
  const p = S.players[pid], t = myTeam();
  if (!p || p.teamId !== t.id || !p.on40) return 'その選手は40人枠にいません。';
  if (S.phase === 'post') return 'ポストシーズン中はできません。';
  if (p.r5 && p.r5.to === t.id) { r5Return(p); ensureLineup(S, t); return null; }
  // ウェーバー：成績の悪い順に、その選手が 40 人枠のいちばん下よりはっきり上なら取る（年俸が高すぎる選手は取らない）
  const order = sortTeams(S.teams).reverse().filter(o => o.id !== t.id);
  const worstOf = o => fortyOf(o).filter(x => !isActive(o, x) && !underContract(x)).sort((a, b) => tradeValue(a) - tradeValue(b))[0];
  const claim = p.salary <= calcSalary(p) * 1.3 && order.find(o => {
    const w = worstOf(o);
    return (count40(o) < FORTY_MAX ? tradeValue(p) > 40 : w && tradeValue(p) > tradeValue(w) * 1.15) && U.chance(0.6);
  });
  if (claim) {
    removeFromTeam(p);
    if (count40(claim) >= FORTY_MAX) drop40(worstOf(claim));
    sign40(claim, p); p.lvl = '3A';
    autoActive(claim);
    addNews(`${p.name}を40人枠から外したところ、${claim.short}がウェーバーで取りました。`, 'bad');
  } else {
    drop40(p);
    addNews(`${p.name}を40人枠から外しました（DFA）。どの球団も取らなかったので、マイナー契約で残ります。`);
  }
  ensureLineup(S, t);
  return null;
}

// 自由契約にする（球団から外す）。契約の途中の選手はできない
function releasePlayer(pid) {
  const p = S.players[pid];
  const t = myTeam();
  if (!releaseOpen()) return 'ポストシーズン中はできません。';
  if (p.retireNext) return `${p.name}は今季かぎりで引退します。`;
  if (underContract(p)) return `${p.name}は契約の途中なので、自由契約にできません（40人枠から外すことはできます）。`;
  if (t.players.length <= FORTY_MAX) return 'これ以上は減らせません。';
  if (p.r5 && p.r5.to === t.id) { r5Return(p); ensureLineup(S, t); return null; }
  toFreeAgent(p);
  ensureLineup(S, t);
  addNews(`${p.name}を自由契約にしました。`);
  return null;
}

function facLv(t, k) { return t.fac[k] || 1; }

function upkeepTotal(t) { return U.sum(Object.keys(FACILITIES), k => facilityUpkeep(facLv(t, k), k)); }

// レベルを 1 つ下げる。維持費は減るが、改修に使ったお金は戻らない
function downgradeFacility(k) {
  const t = myTeam();
  const lv = facLv(t, k);
  if (lv <= 1) return;
  t.fac[k] = lv - 1;
  addNews(`${FACILITIES[k].name}をレベル${t.fac[k]}に縮小しました。`, 'bad');
}

function upgradeFacility(k) {
  const t = myTeam();
  const lv = facLv(t, k);
  if (lv >= FAC_MAX) return;
  const cost = facilityCost(lv, k);
  if (t.money < cost) return;
  t.money -= cost; t.fin.invest += cost;
  t.fac[k] = lv + 1;
  addNews(`${FACILITIES[k].name}をレベル${t.fac[k]}に改修しました（${U.money(cost)}）。`, 'good');
}

// ---------- 宣伝 ----------
// 今季の宣伝で上がったグッズの売上の倍率
function goodsPromoMul(t) { return 1 + U.sum(t.promoUsed || [], k => (PROMOS[k] && PROMOS[k].goods) || 0); }

function runPromo(k) {
  const t = myTeam(), pr = PROMOS[k];
  if (!pr) return 'その宣伝はありません。';
  if (S.phase !== 'season') return '宣伝はシーズン中にしかできません。';
  if (t.promoUsed.includes(k)) return `${pr.name}は今季もう行いました。`;
  if (t.money < pr.cost) return 'お金が足りません。';
  t.money -= pr.cost; t.fin.invest += pr.cost;
  t.promoUsed.push(k);
  addNews(`${pr.name}を行いました（${U.money(pr.cost)}）。今季のグッズの売上が ${Math.round(pr.goods * 100)}% 上がります！`, 'good');
  return null;
}

// ---------- グッズ ----------
function goodsName(g) {
  const ty = GOODS_TYPES[g.type];
  return ty.player ? `${g.pname} ${ty.name}` : ty.name;
}

// 出たばかりはよく売れ、だんだん飽きられる
function goodsFresh(g) { return g.dev > 0 ? 1.3 : Math.max(0.5, 1.3 - g.sold * 0.01); }

// ホーム 1 試合あたりの売上（万円）
function goodsRate(t, g) {
  const ty = GOODS_TYPES[g.type];
  let r = ty.base * (0.5 + t.pop / 100);
  if (ty.player) {
    const p = S.players[g.pid];
    if (!p) return 0;
    r *= 0.1 + p.fame / 45;
    r *= 1 + (p.visual * 0.2 - 0.4) * ty.visual;
  }
  return r * goodsFresh(g) * goodsPromoMul(t) * incomeMul();
}

function sellGoods(t, isHome) {
  t.goods.forEach(g => {
    if (g.dev > 0) {
      g.dev--;
      if (!g.dev) addNews(`${goodsName(g)}が発売されました！`, 'good');
      return;
    }
    const v = goodsRate(t, g) * (isHome ? 1 : AWAY_SALES) * U.rnd(0.85, 1.15);
    g.sold++; g.total += v; g.season += v; g.last = v;
    t.money += v; t.fin.goods += v;
  });
}

function developGoods(type, pid) {
  const t = myTeam(), ty = GOODS_TYPES[type];
  if (!ty) return 'グッズの種類を選んでください。';
  if (t.goods.length >= GOODS_MAX) return `グッズは同時に${GOODS_MAX}個までです。古いものを販売終了してください。`;
  let p = null;
  if (ty.player) {
    p = S.players[pid];
    if (!p || p.teamId !== t.id) return '選手を選んでください。';
    if (t.goods.some(g => g.type === type && g.pid === p.id)) return 'そのグッズはもうあります。';
  } else if (t.goods.some(g => g.type === type)) return 'そのグッズはもうあります。';
  if (t.money < ty.cost) return 'お金が足りません。';
  t.money -= ty.cost; t.fin.invest += ty.cost;
  const g = { id: t.nextGoodsId++, type, pid: p ? p.id : null, pname: p ? p.name : '', dev: ty.days, sold: 0, total: 0, season: 0, last: 0 };
  t.goods.push(g);
  if (p) { addLoyalty(p, 15); addFame(p, 2); }
  addNews(`${goodsName(g)}の開発を始めました（${U.money(ty.cost)}・${ty.days}試合後に発売）。${p ? `${p.name}もうれしそうだ。` : ''}`);
  return null;
}

function stopGoods(id) {
  const t = myTeam();
  const g = t.goods.find(x => x.id === id);
  if (!g) return;
  t.goods = t.goods.filter(x => x !== g);
  addNews(`${goodsName(g)}の販売を終了しました（通算売上 ${U.money(g.total)}）。`);
}

// 選手がいなくなったら、その選手のグッズは売れなくなる
function endPlayerGoods(t, p) {
  if (!t.goods) return;
  const gone = t.goods.filter(g => g.pid === p.id);
  if (!gone.length) return;
  t.goods = t.goods.filter(g => g.pid !== p.id);
  if (t.id === S.myTeamId) gone.forEach(g => addNews(`${p.name}が球団を離れたため、${goodsName(g)}は販売終了になりました。`, 'bad'));
}

// セーブデータに足りない値を足す（これからの版で値が増えたときのため）
function migrate() {
  ['popups', 'freeAgents', 'pickTrades', 'watch', 'standHist', 'awardHist', 'retired', 'draftHist', 'news', 'history'].forEach(k => { if (!S[k]) S[k] = []; });
  if (!S.records) S.records = { season: {} };
  S.teams.forEach(t => {
    if (!t.retiredNos) t.retiredNos = [];
    if (!t.goods) t.goods = [];
    Object.keys(newFin()).forEach(k => { if (t.fin[k] == null) t.fin[k] = 0; });
  });
}

// ---------- 保存 ----------
// セーブはパワプロのようにスロットに分ける。スロットごとに中身と「見出し（どの球団の何年か）」を別々に持つ
const SLOT_COUNT = 3;
let currentSlot = null; // いま遊んでいるスロット（1〜3）

function slotKey(n) { return `${SAVE_KEY}_slot${n}`; }
function metaKey(n) { return `${SAVE_KEY}_meta${n}`; }

function makeMeta() {
  const t = myTeam();
  const when = S.phase === 'season' ? curDateLabel() : S.phase === 'post' ? 'ポストシーズン' : 'オフ';
  return {
    team: t.name, color: t.color, year: S.year, when, w: t.w, l: t.l, d: t.d,
    lg: divName(t.lg, t.div), rank: rankOf(t.id), money: t.money, titles: S.history.filter(x => x.post === `${FINAL_NAME}優勝`).length,
    savedAt: Date.now(),
  };
}

// セーブは圧縮して置く（lz-string。だいたい 9 分の 1 になる）。頭に「LZ1:」が付いていれば圧縮、なければ前の形のまま読む
const SAVE_LZ = 'LZ1:';
function packSave(obj) { return SAVE_LZ + LZString.compressToUTF16(JSON.stringify(obj)); }
function unpackSave(raw) { return JSON.parse(raw.startsWith(SAVE_LZ) ? LZString.decompressFromUTF16(raw.slice(SAVE_LZ.length)) : raw); }

// 圧縮には時間がかかるので、ふだんの保存は少し待ってから裏でまとめてする（save-worker.js）
let saveOk = true, saveDirty = false, saveTimer = null, saveWorker = null, saveSeq = 0, saveBusy = false;

// 保存を頼む。前の保存がうまくいっていれば true（容量がいっぱいなどで失敗していたら false）
function saveGame() {
  if (!S || !currentSlot) return true;
  saveDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveInBackground, 600);
  return saveOk;
}

// いますぐ保存する（タイトルへ戻る・読み込み直す・閉じるときなど）。できたら true
function saveGameNow() {
  clearTimeout(saveTimer);
  if (!S || !currentSlot) { saveDirty = false; return true; }
  saveDirty = false;
  saveSeq++; // 裏で圧縮中の古い分は捨てる
  saveBusy = false;
  try {
    localStorage.setItem(slotKey(currentSlot), packSave(S));
    localStorage.setItem(metaKey(currentSlot), JSON.stringify(makeMeta()));
    saveOk = true;
  } catch (e) {
    console.warn('保存できませんでした', e);
    saveOk = false;
  }
  return saveOk;
}
function flushSave() { if (saveDirty || saveBusy) saveGameNow(); }

function saveInBackground() {
  if (!saveDirty || !S || !currentSlot) return;
  if (!saveWorker) {
    try { saveWorker = new Worker('js/save-worker.js'); } catch (e) { saveWorker = false; }
  }
  if (!saveWorker) { saveGameNow(); return; }
  const seq = ++saveSeq, slot = currentSlot, meta = JSON.stringify(makeMeta());
  saveDirty = false;
  saveBusy = true;
  saveWorker.onmessage = e => {
    if (e.data.seq !== saveSeq) return; // もっと新しい保存が来ている
    saveBusy = false;
    try {
      localStorage.setItem(slotKey(slot), SAVE_LZ + e.data.out);
      localStorage.setItem(metaKey(slot), meta);
      saveOk = true;
    } catch (err) {
      console.warn('保存できませんでした', err);
      saveOk = false;
      UI.toast = '保存できませんでした（ブラウザの保存容量がいっぱいかもしれません）。';
      render();
    }
  };
  saveWorker.onerror = () => { saveWorker = false; saveGameNow(); };
  saveWorker.postMessage({ seq, json: JSON.stringify(S) });
}
// 閉じる・裏に回るときは、待たずに保存しておく
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });

function loadGame(n) {
  try {
    flushSave();
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return false;
    S = unpackSave(raw);
    migrate();
    currentSlot = n;
    return true;
  } catch (e) { return false; }
}

function slotMeta(n) {
  try { const raw = localStorage.getItem(metaKey(n)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

function deleteSlot(n) {
  if (n === currentSlot) { clearTimeout(saveTimer); saveSeq++; saveDirty = false; saveBusy = false; } // 消したあとに、裏の保存で書き戻さない
  try { localStorage.removeItem(slotKey(n)); localStorage.removeItem(metaKey(n)); localStorage.removeItem(expKey(n)); } catch (e) { /* なにもしない */ }
}

// ---------- セーブのファイル書き出し・読み込み ----------
// ブラウザのデータを消しても、書き出したファイルから戻せる。パソコンとスマホの間で移すのにも使える
const SAVE_FILE_APP = 'mlb-management';
function expKey(n) { return `${SAVE_KEY}_exp${n}`; }

// スロット n の中身をファイルにする文字列と名前を作る（n が遊んでいるスロットなら、いまの状態を使う）
function exportSlot(n) {
  let data;
  if (n === currentSlot && S) data = S;
  else {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    data = unpackSave(raw);
  }
  const meta = slotMeta(n) || {};
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const team = data.teams && data.teams[data.myTeamId] ? data.teams[data.myTeamId].short : 'セーブ';
  const name = `メジャー監督_${team}_${data.year}年_${ymd}.json`;
  const text = JSON.stringify({ app: SAVE_FILE_APP, format: 1, exportedAt: Date.now(), meta, data });
  try { localStorage.setItem(expKey(n), String(Date.now())); } catch (e) { /* 書き出し日が残せなくても、ファイルはできる */ }
  return { name, text };
}

function lastExport(n) {
  try { const v = localStorage.getItem(expKey(n)); return v ? +v : null; } catch (e) { return null; }
}

// シーズンの終わりに「書き出しますか？」と聞くかどうか（端末ごと）
const NO_ASK_KEY = `${SAVE_KEY}_noBackupAsk`;
function backupAskOff() { try { return localStorage.getItem(NO_ASK_KEY) === '1'; } catch (e) { return false; } }
function setBackupAskOff(v) { try { if (v) localStorage.setItem(NO_ASK_KEY, '1'); else localStorage.removeItem(NO_ASK_KEY); } catch (e) { /* なにもしない */ } }

// ファイルの中身を確かめて、スロット n に入れる。だめなら理由を返す
function importToSlot(n, text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return 'ファイルを読めませんでした（壊れているか、ちがう種類のファイルです）。'; }
  const data = obj && obj.app === SAVE_FILE_APP ? obj.data : null;
  if (!data || !Array.isArray(data.teams) || !data.players || data.myTeamId == null) return 'このゲームのセーブファイルではありません。';
  const keepS = S, keepSlot = currentSlot;
  try {
    S = data;
    migrate();
    currentSlot = n;
    if (!saveGameNow()) return '保存できませんでした（ブラウザの保存容量がいっぱいかもしれません）。';
    localStorage.setItem(expKey(n), String(obj.exportedAt || Date.now()));
  } catch (e) {
    return 'セーブの中身がおかしいため、読み込めませんでした。';
  } finally {
    S = keepS; currentSlot = keepSlot;
  }
  return null;
}

// ブラウザに「このサイトのデータは勝手に消さないで」と頼む（できないブラウザもある）
let storagePersisted = null;
function askPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persisted) { storagePersisted = 'unsupported'; return; }
  navigator.storage.persisted()
    .then(p => (p ? true : navigator.storage.persist()))
    .then(p => { storagePersisted = !!p; })
    .catch(() => { storagePersisted = 'unsupported'; });
}

// いまのデータを別のスロットにも残す（バックアップ）
function copyToSlot(n) {
  try {
    localStorage.setItem(slotKey(n), packSave(S));
    localStorage.setItem(metaKey(n), JSON.stringify(makeMeta()));
    return true;
  } catch (e) { return false; }
}

// スロットがなかったころのセーブは、スロット 1 に移す
function migrateOldSave() {
  try {
    const old = localStorage.getItem(SAVE_KEY);
    if (!old) return;
    if (!localStorage.getItem(slotKey(1))) {
      S = JSON.parse(old);
      migrate();
      currentSlot = 1;
      saveGameNow();
      S = null;
      currentSlot = null;
    }
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { S = null; currentSlot = null; }
}
