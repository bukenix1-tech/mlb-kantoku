'use strict';

// 画面を描く（状態 S を読んで HTML を作るだけ）

const UI = {
  tab: 'home', viewTeam: null, trade: { team: null, give: [], get: [], cash: 0 }, extDraft: {}, toast: '',
  sortKey: null, newTeam: 0, newGames: 162, arbDraft: {}, intlDraft: {}, intlYears: {}, lg: null, newSlot: null, watchOnly: false, pkind: '', faDraft: {}, histYear: null, posf: { team: '', draft: '', fa: '' }, geniusOnly: false, teamView: 'list', statSort: { bat: 'avg', pit: 'era' }, goodsType: 'towel', goodsPid: null, draftYearF: '', dhYear: null, recView: 'hist', recYear: null, slimUntil: null, slimScope: 'other',
};

const TABS = [
  ['home', 'ホーム'], ['team', 'チーム'], ['roster', '26人・40人枠'], ['order', 'オーダー'], ['train', '練習'],
  ['sched', '日程'], ['stand', '順位・成績'], ['money', '経営'], ['trade', 'トレード'], ['fa', '自由契約'], ['prospects', 'ドラフト候補'], ['records', '記録・殿堂'],
];

const h = U.esc;

// ---------- スマホ用 ----------
// 画面の幅が狭いとき（スマホ）は、選手の表をカードにする。パソコンでは今までどおり表
function isMobile() { return window.matchMedia('(max-width: 700px)').matches; }

// 選球眼（特殊能力）。なしのときは何も出さない
function eyeTag(p) {
  const e = canBat(p) ? eyeOf(p) : 0;
  return e ? `<span class="tag eye e${e < 0 ? 'x' : e}" title="${e < 0 ? '早打ち（四球が少ない）' : `選球眼${EYE_MARK[e]}（四球が多く、三振が少ない）`}">${e < 0 ? '早打ち' : '眼' + EYE_MARK[e]}</span>` : '';
}
// 弾道（↗の数）。野手だけ
function trajTag(p, batOnly) {
  const style = !batOnly && canPitch(p) ? `<span class="tag" title="持ち球と変化量（1〜7）">${pitchBrief(p)}</span><span class="tag" title="持ち球から決まる投球のタイプ">${pitchStyle(p)}</span>` : '';
  if (!canBat(p)) return style;
  const t = trajOf(p), b = batSide(p);
  const bats = b === '右' ? '' : `<span class="bats">${b}</span>`; // 右打ちは多いので出さない
  return `<span class="ab traj t${t}" title="${b === '右' ? '' : b === '左' ? '左打ち・' : '両打ち（スイッチヒッター）・'}弾道${t}（高いほどホームランとフライが多い）">${bats}弾<b>${t}</b></span>${style}`;
}
// 持ち球の一覧。ドラフト候補はスカウトの見立てしか分からないので、変化量を出さない
function pitchList(p) {
  return pitchesOf(p).map(t => `<span class="tag">${pitchArrow(p, t)}${PITCHES[t].name}${p.noise ? '' : ` <b>${pitchLevel(p, t)}</b>`}</span>`).join(' ');
}
// 表に入れる短い持ち球（スラ5 フォ4）
function pitchBrief(p) {
  return pitchesOf(p).map(t => `<span class="pch">${pitchArrow(p, t)}${PITCHES[t].short}${p.noise ? '' : pitchLevel(p, t)}</span>`).join('');
}
// 表の球種の欄。3 つずつで折り返して、欄が横に広がりすぎないようにする
function pitchCell(p) { return `<td class="small"><div class="pbrief">${pitchBrief(p)}</div></td>`; }
// 曲がる向きの矢印（→↘↓↙←）。FE0E は絵文字にしないための印
const DIR_ARROWS = ['→', '↘', '↓', '↙', '←'];
function pitchArrow(p, t) { return `<span class="parr">${DIR_ARROWS[U.clamp(Math.round(pitchDir(p, t) / 45), 0, 4)]}︎</span>`; }
// 選手の画面の変化球の図。中心から曲がる向きに矢印をのばし、長さで変化量を見せる
// 変化球の図（人の言葉 2026-11-11「球種の真ん中の・をボールの形にして」）。真ん中のボールから、曲がる向きに 7 マスの目盛りを並べ、変化量のぶんだけ塗る
const PCHART_STEP = 11, PCHART_IN = 15, PCHART_MAXLV = 7;
function pitchChart(p) {
  const cx = 130, cy = 30, at = (d, r) => [cx + Math.cos(d) * r, cy + Math.sin(d) * r].map(v => +v.toFixed(1));
  const placed = []; // 置いた字の場所。重なったら外へ少しずつずらす
  const marks = pitchesOf(p).map(t => {
    const d = pitchDir(p, t) * Math.PI / 180, lv = pitchLevel(p, t);
    let cells = '';
    for (let i = 0; i < PCHART_MAXLV; i++) {
      const [x1, y1] = at(d, PCHART_IN + i * PCHART_STEP + 1), [x2, y2] = at(d, PCHART_IN + (i + 1) * PCHART_STEP - 1);
      cells += `<line class="${i < lv ? 'on' : 'off'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    let r = PCHART_IN + PCHART_MAXLV * PCHART_STEP + 12, lx, ly;
    for (let i = 0; i < 8; i++, r += 8) {
      [lx, ly] = at(d, r);
      if (!placed.some(([px, py]) => Math.abs(px - lx) < 30 && Math.abs(py - ly) < 15)) break;
    }
    placed.push([lx, ly]);
    return `${cells}<text x="${lx}" y="${(ly + 4).toFixed(1)}" text-anchor="middle">${PITCHES[t].short}<tspan class="lv">${lv}</tspan></text>`;
  }).join('');
  // 真ん中のボール（白い球に赤い縫い目）
  const ball = `<circle class="ball" cx="${cx}" cy="${cy}" r="9"/>
    <path class="seam" d="M${cx - 5} ${cy - 7.4}Q${cx - 1.5} ${cy} ${cx - 5} ${cy + 7.4}M${cx + 5} ${cy - 7.4}Q${cx + 1.5} ${cy} ${cx + 5} ${cy + 7.4}"/>`;
  return `<svg class="pchart" viewBox="0 0 260 185" role="img" aria-label="変化球の向きと変化量">
    <line class="axis" x1="6" y1="${cy}" x2="254" y2="${cy}"/><line class="axis" x1="${cx}" y1="4" x2="${cx}" y2="170"/>
    ${marks}${ball}
    <text class="hand" x="4" y="180">${isLefty(p) ? '左投げ' : '右投げ'}（捕手から見た向き）</text></svg>`;
}
// スカウトの見立ての球のキレ（ドラフト候補の欄で使う）
function kireTag(p) {
  if (!canPitch(p)) return '';
  const g = U.grade(scoutView(p, 'kire'));
  return `<span class="ab" title="スカウトが見た、球のキレ">${SHORT_LABEL.kire}<span class="g g${g}">${g}</span></span>`;
}

function abilSum(p, view) {
  const v = k => (view ? scoutView(p, k) : p.a[k]);
  return abilKeys(p).map(k => `<span class="ab">${SHORT_LABEL[k]}${k === 'velo' ? veloKmh(v(k)) + 'km' : `<span class="g g${U.grade(v(k))}">${U.grade(v(k))}</span>`}</span>`).join('') + (view ? kireTag(p) : '') + trajTag(p) + eyeTag(p);
}

function statLine(p) {
  const s = p.stats, out = [];
  if (canBat(p)) out.push(`打率${U.avg(s.h, s.ab)} ${s.hr}本 ${s.rbi}点 ${s.sb}盗`);
  if (canPitch(p)) out.push(`${s.pg}登板 ${s.w}勝${s.l}敗${s.sv ? s.sv + 'S' : ''} 防御率${U.era(s.per, s.outs)}`);
  return out.join(' ／ ');
}

// o: { lead, name, ovr, sub, lines, action, view, noCond, cls }
function playerCard(p, o = {}) {
  return `<div class="pcard ${o.cls || ''}">
    <div class="pc-top">${o.lead || ''}<div class="pc-name">${o.name || nameCell(p)}</div><div class="pc-ovr"><small>総合</small>${o.ovr != null ? o.ovr : Math.round(ovr(p))}</div></div>
    <div class="pc-sub">${posBadge(p)}<span>${p.age}歳</span>${o.view ? '' : phaseMark(p)}${o.noCond ? '' : condCell(p)}${o.sub || ''}</div>
    <div class="pc-abil">${abilSum(p, o.view)}</div>
    ${o.lines || ''}
    ${o.action ? `<div class="pc-act">${o.action}</div>` : ''}
  </div>`;
}

// 成長の時期の印（成長期・ピーク・衰退期）
function phaseMark(p) {
  const g = growthPhase(p);
  return `<span class="phase ph-${g.k}" title="${g.name}">${g.short}</span>`;
}

// 18〜40 歳の帯に、成長期・ピーク・衰退期と、いまの歳を描く
function growthBar(p) {
  const g = growthSpan(p), A0 = 18, A1 = 40;
  const pc = a => ((U.clamp(a, A0, A1 + 1) - A0) / (A1 + 1 - A0)) * 100;
  const seg = (from, to, k, name) => (to < from ? '' : `<span class="gb-seg ph-${k}" style="left:${pc(from)}%;width:${pc(to + 1) - pc(from)}%">${name}</span>`);
  return `<div class="gbar">${seg(A0, g.growEnd, 'grow', '成長期')}${seg(g.peakFrom, g.peakTo, 'peak', 'ピーク')}${seg(g.declineFrom, A1, 'decline', '衰退期')}
    <span class="gb-now" style="left:${pc(p.age + 0.5)}%"><b>${p.age}歳</b></span></div>
    <div class="gb-ages"><span>${A0}</span><span>${A1}歳</span></div>`;
}

function cardList(list, fn) { return `<div class="pcards">${list.map(fn).join('') || '<p class="muted">いません</p>'}</div>`; }

// ポジションの分け方（投手は先発と中継ぎ、野手は守備位置）
const POS_GROUPS = ['先発', '中継ぎ', '捕', '一', '二', '三', '遊', '外'];
// ローテや勝ちパターンに入っていない投手は、スタミナで先発型か中継ぎ型かを決める
// 先発・中継ぎは適性が ○ 以上なら数える（両方に入る投手もいる）
function posMatch(p, g) {
  if (!g) return true;
  if (g === '先発') return canPitch(p) && aptOf(p).sp >= 1;
  if (g === '中継ぎ') return canPitch(p) && aptOf(p).rp >= 1;
  return canBat(p) && (p.isP ? p.pos2 : p.pos) === g;
}

// ポジションの色つきの印（投手は先発・中継ぎの適性も）
function aptBadge(p) {
  const a = aptOf(p);
  return `<span class="apt a${a.sp}">先${APT_MARK[a.sp]}</span><span class="apt a${a.rp}">中${APT_MARK[a.rp]}</span>`;
}
// サブポジ（本職のほかに守れる位置）は、小さく薄い札で
function subsBadge(p) {
  const s = subsOf(p);
  return s.length ? `<span class="subs" title="サブポジ：${s.join('・')}（本職より少し守備が弱い）">${s.map(x => `<span class="pb sub pb-${x}">${x}</span>`).join('')}</span>` : '';
}
function posBadge(p) {
  const out = [];
  if (canPitch(p)) out.push(`<span class="pb pb-投">投</span>${aptBadge(p)}`);
  if (canBat(p)) { const ps = p.isP ? p.pos2 : p.pos; out.push(`<span class="pb pb-${ps}">${ps}</span>${subsBadge(p)}`); }
  return `<span class="pbs">${out.join('')}</span>`;
}

// 自分のチームのポジションごとの人数（カッコは 26 人枠）
function posCounts() {
  const t = myTeam();
  const ps = teamPlayers(t);
  return `<div class="poscount"><span class="muted">${h(t.short)}の人数：</span>${POS_GROUPS.map(g => {
    const all = ps.filter(p => posMatch(p, g));
    const act = all.filter(p => t.active.includes(p.id)).length;
    return `<span class="pc"><b>${g}</b> ${all.length}<small>（26人枠${act}）</small></span>`;
  }).join('')}<span class="pc">40人枠 <b>${count40(t)}</b>/${FORTY_MAX}</span><span class="pc">計 <b>${ps.length}</b>/${ROSTER_MAX}</span></div>`;
}

// ポジションでしぼり込むボタン
function posFilter(key) {
  const cur = UI.posf[key] || '';
  return `<div class="seg wrapseg">${[['', 'すべて'], ...POS_GROUPS.map(g => [g, g])].map(([g, n]) => `<button class="${cur === g ? 'on' : ''}" data-act="posf" data-key="${key}" data-g="${g}">${n}</button>`).join('')}</div>`;
}

function gradeCell(v) {
  const g = U.grade(v);
  return `<span class="g g${g}">${g}</span><small class="num">${Math.round(v)}</small>`;
}
function condCell(p) { return `<span class="cond c${p.cond}" title="${COND_LABEL[p.cond]}">${COND_ICON[p.cond]}</span>`; }
function nameCell(p) {
  const inj = p.inj ? `<span class="tag bad">${p.il60 ? '60日IL' : p.il ? 'IL' : '故障'}${p.inj}日</span>` : '';
  const t = p.teamId != null ? S.teams[p.teamId] : null;
  const farm = t && t.active && !t.active.includes(p.id) ? `<span class="tag farm" title="${p.on40 ? '40人枠（マイナーにいる）' : 'マイナー契約'}">${p.lvl || '3A'}${p.on40 ? '' : '・マ'}</span>` : '';
  const tw = p.twoWay ? '<span class="tag twoway">二刀流</span>' : '';
  const gn = p.geniusKnown ? '<span class="tag genius">天才</span>' : '';
  const gr = t && t.id === S.myTeamId && grumbling(t, p) ? '<span class="tag bad" title="力はあるのに出番が少なく、忠誠心が下がっています">不満</span>' : '';
  const rt = p.retiring || p.retireNext ? '<span class="tag bad">引退予定</span>' : '';
  const r5 = p.r5 && t && p.r5.to === t.id ? '<span class="tag" title="ルール5で取った選手。26人枠から外すと元の球団に返します">R5</span>' : '';
  return `<a href="#" data-act="player" data-pid="${p.id}">${h(p.name)}</a>${tw}${gn}${farm}${r5}${inj}${gr}${rt}`;
}
function teamChip(t) { return `<span class="chip" style="background:${t.color}">${h(t.short)}</span>`; }

function render() {
  const app = document.getElementById('app');
  if (!S) { app.innerHTML = renderTitle() + (UI.toast ? `<div class="toast">${h(UI.toast)}</div>` : ''); UI.toast = ''; return; }
  const first = S.phase === 'off' ? ['off', 'オフシーズン'] : S.phase === 'post' ? ['post', 'ポストシーズン'] : TABS[0];
  const tabs = [first, ...(S.phase === 'season' && S.draft ? [['draft', '📝 ドラフト']] : []), ...TABS.slice(1)];
  if (UI.tab === 'draft' && !(S.phase === 'season' && S.draft)) UI.tab = first[0];
  if (['home', 'off', 'post'].includes(UI.tab)) UI.tab = first[0];
  const scrolled = keepScroll(app);
  const oldNav = app.querySelector('nav.tabs'), navX = oldNav ? oldNav.scrollLeft : 0; // 上のタブの横の位置（押したら左端に戻らないように）
  app.innerHTML = `
    ${renderHeader()}
    <nav class="tabs">${tabs.map(([k, n]) => `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</nav>
    <main>${renderScreen()}</main>
    ${UI.toast ? `<div class="toast">${h(UI.toast)}</div>` : ''}`;
  UI.toast = '';
  scrolled();
  const nav = app.querySelector('nav.tabs'), on = nav && nav.querySelector('button.on');
  if (nav) {
    nav.scrollLeft = navX;
    if (on) { // 選んだタブが見えないときだけ寄せる
      const a = on.getBoundingClientRect(), b = nav.getBoundingClientRect();
      if (a.left < b.left || a.right > b.right) nav.scrollLeft += a.left - b.left - 8;
    }
  }
}

// 描き直しても、表の横スクロールの位置を保つ。同じ見出しの表を同じ順番で探して戻す（画面を切り替えたときは戻さない）
let scrollTab = null;
function keepScroll(app) {
  const list = () => {
    const seen = {};
    return [...app.querySelectorAll('.scroll')].map(el => {
      const head = el.querySelector('tr');
      const name = head ? head.textContent : '';
      seen[name] = (seen[name] || 0) + 1;
      return { el, key: `${name}#${seen[name]}` };
    });
  };
  const same = scrollTab === UI.tab;
  scrollTab = UI.tab;
  const old = same ? new Map(list().filter(x => x.el.scrollLeft).map(x => [x.key, x.el.scrollLeft])) : new Map();
  return () => list().forEach(x => { if (old.has(x.key)) x.el.scrollLeft = old.get(x.key); });
}

function renderScreen() {
  switch (UI.tab) {
    case 'off': return renderOff();
    case 'post': return renderPost();
    case 'team': return renderTeam();
    case 'order': return renderOrder();
    case 'roster': return renderRoster();
    case 'train': return renderTrain();
    case 'sched': return renderSched();
    case 'stand': return renderStand();
    case 'money': return renderMoney();
    case 'trade': return renderTrade();
    case 'fa': return renderFA();
    case 'prospects': return renderProspects();
    case 'draft': return renderDraft();
    case 'records': return renderRecords();
    default: return renderHome();
  }
}

// ---------- タイトル ----------
function slotWhen(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderSlotCard(n) {
  const m = slotMeta(n);
  const importBtn = `<label class="filebtn">📂 ファイルから読み込む<input type="file" accept=".json,application/json" data-chg="importFile" data-n="${n}"></label>`;
  if (!m) {
    return `<div class="slot empty">
      <div class="slot-no">スロット${n}</div>
      <div class="slot-body muted">データなし</div>
      <div class="slot-btns"><button class="primary" data-act="slotNew" data-n="${n}">ここで新しく始める</button>${importBtn}</div>
    </div>`;
  }
  const ex = lastExport(n);
  return `<div class="slot" style="--c:${m.color}">
    <div class="slot-no">スロット${n}</div>
    <div class="slot-body">
      <div class="slot-team">${h(m.team)}</div>
      <div>${m.year}年 ${h(m.when)} ・ ${m.w}勝${m.l}敗${m.d ? m.d + '分' : ''} ${h(m.lg)}${m.rank}位</div>
      <div class="muted">資金 ${U.money(m.money)}${m.titles ? ` ・ 優勝 ${m.titles}回` : ''} ・ 保存 ${slotWhen(m.savedAt)}</div>
      <div class="muted small">${ex ? `ファイルに書き出したのは ${slotWhen(ex)}` : 'まだファイルに書き出していません'}</div>
    </div>
    <div class="slot-btns">
      <button class="primary big" data-act="continue" data-n="${n}">つづきから</button>
      <button class="sm" data-act="exportSlot" data-n="${n}">💾 ファイルに書き出す</button>
      ${importBtn}
      <button class="sm" data-act="slotNew" data-n="${n}">上書きして新しく始める</button>
      <button class="sm danger" data-act="slotDelete" data-n="${n}">消す</button>
    </div>
  </div>`;
}

function renderTitle() {
  if (!UI.newSlot) {
    return `
    <div class="title">
      <h1>⚾ メジャー監督</h1>
      <p class="sub">30 球団のメジャーリーグで、育てて、稼いで、ユニバースシリーズ制覇を目指せ。</p>
      <section class="card">
        <h2>データを選んでください</h2>
        <div class="slots">${Array.from({ length: SLOT_COUNT }, (_, i) => renderSlotCard(i + 1)).join('')}</div>
        <p class="note">試合を進めるたびに、選んだスロットへ自動で保存されます。ほかのスロットは変わりません。</p>
        <p class="note">ブラウザの閲覧データを消すと、セーブも消えます。ときどき「ファイルに書き出す」で残しておくと、消えても「ファイルから読み込む」で戻せます。</p>
        ${versionLine()}
      </section>
    </div>`;
  }
  const m = slotMeta(UI.newSlot);
  return `
  <div class="title">
    <h1>⚾ メジャー監督</h1>
    <section class="card">
      <div class="row"><h2>スロット${UI.newSlot}で新しく始める</h2><button data-act="slotBack">◀ もどる</button></div>
      ${m ? `<p class="neg"><b>注意：</b>スロット${UI.newSlot}の「${h(m.team)} ${m.year}年」のデータは消えます。</p>` : ''}
      <p>率いる球団を選んでください。<span class="muted small">市場：大きいほど収入が多い</span></p>
      ${LEAGUES.map(lg => `<h3>${LEAGUE_NAME[lg]}</h3>${DIVS.map(dv => `<h4>${dv}地区</h4><div class="teampick">
        ${TEAM_DEFS.map((d, i) => d.lg !== lg || d.div !== dv ? '' : `<button class="tp ${UI.newTeam === i ? 'on' : ''}" style="--c:${d.color}" data-act="pickTeam" data-i="${i}">${h(d.name)}<small>（市場 ${d.mk}）</small></button>`).join('')}
      </div>`).join('')}`).join('')}
      <p>1 シーズンの試合数：
        ${Object.keys(SEASON_FORMATS).sort((a, b) => b - a).map(n => `<label><input type="radio" name="games" value="${n}" data-chg="games" ${UI.newGames === +n ? 'checked' : ''}> ${SEASON_FORMATS[n].label}</label>`).join(' ')}
      </p>
      <p class="muted">2 リーグ・6 地区・30 球団。5 人ローテ。シーズンのあとは各リーグ 6 球団のポストシーズン（ワイルドカード → 地区シリーズ → リーグ優勝決定シリーズ → ${FINAL_NAME}）。7 月のオールスターの休みにドラフト。</p>
      <button class="big primary" data-act="newGame">プレイボール！</button>
    </section>
  </div>`;
}

// ---------- 上の帯 ----------
function renderHeader() {
  const t = myTeam();
  const rank = rankOf(t.id);
  let adv = '<span class="tag">オフシーズン</span>';
  if (S.phase === 'season' && S.draft && !S.draft.finished) {
    adv = '<button class="primary" data-act="tab" data-tab="draft">📝 ドラフト会議へ</button>';
  } else if (S.phase === 'season') {
    adv = `<button class="primary" data-act="adv" data-n="game">次の試合 ▶</button>
       <button data-act="adv" data-n="week">1週間 ▶▶</button>
       <button data-act="adv" data-n="all">シーズン終了<span class="hide-m">まで</span> ⏭</button>`;
  } else if (S.phase === 'post') {
    adv = `<button class="primary" data-act="adv" data-n="post1">次の試合 ▶</button>
       <button data-act="adv" data-n="postall"><span class="hide-m">ポストシーズン</span>終了まで ⏭</button>`;
  }
  const when = S.phase === 'season' ? `${curDateLabel()} ・ ${gamesPlayed(t)}/${S.games}試合` : S.phase === 'post' ? 'ポストシーズン' : 'オフ';
  return `
  <header style="--c:${t.color}">
    <div class="hl">
      <div class="tname">${h(t.name)}</div>
      <div class="meta">${S.year}年 ${when}
        ・ <b>${t.w}勝${t.l}敗${t.d ? t.d + '分' : ''}</b> ${divName(t.lg, t.div)}${rank}位 ・ 26人枠 ${t.active.length}/${activeMax()} ・ 40人枠 ${count40(t)}/${FORTY_MAX} ・ 資金 <b class="${t.money < 0 ? 'neg' : ''}">${U.money(t.money)}</b> ・ 人気 ${Math.round(t.pop)}</div>
    </div>
    <div class="hr">${adv}<button class="ghost" data-act="menu" title="メニュー（保存・スロット）">💾<span class="hide-m"> スロット${currentSlot}</span> ☰</button></div>
  </header>`;
}

// ---------- ホーム ----------
// ---------- セーブを守る：ファイルへの書き出しのすすめ ----------
const BACKUP_NAG_DAYS = 7; // 書き出してからこの日数がたったら、ホームで知らせる
function backupAgeDays() { const t = lastExport(currentSlot); return t ? (Date.now() - t) / 86400000 : Infinity; }
const backupButtons = () => `<button class="primary" data-act="exportNow">💾 ファイルに書き出す</button>${navigator.canShare ? ' <button data-act="shareNow">📤 共有して送る（LINE・ドライブなど）</button>' : ''}`;

function backupBanner() {
  const d = backupAgeDays();
  if (d < BACKUP_NAG_DAYS) return '';
  return `<div class="backup-banner"><b>💾 ${d === Infinity ? 'まだセーブをファイルに書き出していません。' : `最後にファイルへ書き出してから${Math.floor(d)}日たちました。`}</b>
    ブラウザのデータが消えると、セーブも消えてしまいます。<div class="backup-btns">${backupButtons()}</div></div>`;
}

function renderBackupAsk() {
  const ex = lastExport(currentSlot);
  return `<div class="backup-ask"><h2>💾 ${S.year}年シーズンおつかれさまでした</h2>
    <p>ここでセーブをファイルに書き出しておくと、ブラウザのデータが消えても、このときから続きを遊べます。</p>
    <p class="muted small">${ex ? `最後に書き出したのは ${slotWhen(ex)}` : 'まだ一度も書き出していません'}</p>
    <p class="backup-btns">${backupButtons()}</p>
    <p><button data-act="closeModal">今回は書き出さない</button></p>
    <label class="small muted"><input type="checkbox" data-chg="noBackupAsk" ${backupAskOff() ? 'checked' : ''}> シーズンの終わりに聞かない（ホームのお知らせと 💾☰ メニューからはいつでも書き出せます）</label></div>`;
}

function renderHome() {
  const t = myTeam();
  let next = '<p>レギュラーシーズンの試合はすべて終わりました。</p>';
  const nm = nextMyGame();
  if (nm) {
    const m = nm.m;
    const opp = S.teams[m.home === t.id ? m.away : m.home];
    const sp = S.players[t.rotation[t.rotIdx % t.rotation.length]];
    const today = S.schedule[S.day];
    const off = today && today.draft ? '<p><b>📝 今日はドラフト会議</b></p>' : today && today.allstar ? '<p><b>⭐ 今日はオールスター</b></p>' : today && !today.games.some(g => g.home === t.id || g.away === t.id) ? '<p class="muted">今日は試合なし（移動日）</p>' : '';
    next = `${off}<p class="muted">${dateLabel(nm.entry)}${m.inter ? ` <span class="tag">${opp.id === t.rival ? 'ライバル戦' : '交流戦'}</span>` : ''}</p>
      <div class="vs">${teamChip(t)} vs ${teamChip(opp)} <span class="muted">（${m.home === t.id ? 'ホーム' : 'ビジター'}）</span></div>
      <p>予告先発：${sp ? nameCell(sp) : '未定'}　相手：${opp.w}勝${opp.l}敗 ${divName(opp.lg, opp.div)}${rankOf(opp.id)}位</p>`;
  }
  const prob = S.phase === 'season' ? rosterProblem(t) : null;
  return `${backupBanner()}
  ${prob ? `<section class="card"><p class="neg">⚠️ ${h(prob)}</p><p><button class="sm primary" data-act="tab" data-tab="roster">26人・40人枠の画面へ</button></p></section>` : ''}
  ${S.draft && !S.draft.finished ? `<section class="card"><p>📝 <b>ドラフト会議の最中です。</b> <button class="sm primary" data-act="tab" data-tab="draft">ドラフトの画面へ</button></p></section>` : ''}
  ${tradeOffers().length ? `<section class="card"><p>📞 トレードの話が <b>${tradeOffers().length} 件</b>来ています。 <button class="sm primary" data-act="tab" data-tab="trade">トレードの画面へ</button></p></section>` : ''}
  <div class="grid2">
    <section class="card"><h2>次の試合（第${Math.min(gamesPlayed(t) + 1, S.games)}戦）</h2>${next}</section>
    <section class="card"><h2>${divName(t.lg, t.div)}</h2>${standTable(standings(t.lg, t.div), true)}
      <h3>${LEAGUE_SHORT[t.lg]}のワイルドカード争い</h3>${wcTable(t.lg, true)}</section>
  </div>
  ${S.lastGame ? `<section class="card"><h2>前の試合（${h(S.lastGame.label)}）</h2>${boxScore(S.lastGame)}</section>` : ''}
  <section class="card"><h2>ニュース</h2>${newsList(20)}</section>`;
}

function newsList(n) {
  const list = S.news.filter(x => x.hide == null || !pbpUnseen(x.hide));
  if (!list.length) return '<p class="muted">まだありません。</p>';
  return `<ul class="news">${list.slice(0, n).map(x => `<li class="${x.kind}"><span class="muted">${x.y} ${typeof x.d === 'number' ? `第${x.d}戦` : x.d}</span> ${h(x.text)}</li>`).join('')}</ul>`;
}

function boxScore(g) {
  const tA = S.teams[g.away], tH = S.teams[g.home];
  const my = S.myTeamId;
  const myIdx = g.home === my ? 1 : 0;
  const won = g.score[myIdx] > g.score[1 - myIdx], lost = g.score[myIdx] < g.score[1 - myIdx];
  const n = Math.max(9, g.line[0].length);
  const cols = Array.from({ length: n }, (_, i) => i);
  const row = (t, i) => `<tr><th>${teamChip(t)}</th>${cols.map(c => `<td>${g.line[i][c] != null ? g.line[i][c] : ''}</td>`).join('')}<td class="r">${g.score[i]}</td><td>${g.hits[i]}</td></tr>`;
  const bat = g.bat[myIdx].map((b, i) => `<tr><td>${i + 1}</td><td>${b.pos}</td><td class="l">${h(b.name)}</td><td>${b.ab}</td><td>${b.h}</td><td>${b.hr}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.k}</td></tr>`).join('');
  const pit = i => g.pit[i].map(p => `<tr><td class="l">${h(p.name)}</td><td>${U.ip(p.outs)}</td><td>${p.pc}</td><td>${p.h}</td><td>${p.r}</td><td>${p.bb}</td><td>${p.k}</td></tr>`).join('');
  const log = g.log.map(x => `<li class="${x.t === 'run' ? (x.side === myIdx ? 'good' : 'bad') : 'muted'}">${h(x.s)}</li>`).join('');
  return `
  <div class="result ${won ? 'win' : lost ? 'lose' : ''}">${won ? '勝利！' : lost ? '敗戦' : '引き分け'}　${h(tA.short)} ${g.score[0]} - ${g.score[1]} ${h(tH.short)}
    <span class="muted">観客 ${g.att.toLocaleString()}人</span></div>
  <div class="scroll"><table class="line"><tr><th></th>${cols.map(c => `<th>${c + 1}</th>`).join('')}<th>計</th><th>安</th></tr>${row(tA, 0)}${row(tH, 1)}</table></div>
  <p>勝：${h(g.wp || '-')}　負：${h(g.lp || '-')}${g.sp ? `　S：${h(g.sp)}` : ''}</p>
  <div class="grid2">
    <div><h3>${h(myTeam().short)}の打撃</h3><div class="scroll"><table class="tbl"><tr><th>#</th><th>守</th><th>選手</th><th>打数</th><th>安</th><th>本</th><th>点</th><th>四</th><th>三振</th></tr>${bat}</table></div></div>
    <div><h3>投手</h3><div class="scroll"><table class="tbl"><tr><th>${h(tA.short)}</th><th>回</th><th>球数</th><th>安</th><th>失</th><th>四</th><th>三振</th></tr>${pit(0)}
      <tr><th>${h(tH.short)}</th><th></th><th></th><th></th><th></th><th></th><th></th></tr>${pit(1)}</table></div></div>
  </div>
  <details><summary>試合の流れ</summary><ul class="log">${log || '<li class="muted">得点なし</li>'}</ul></details>`;
}

// ---------- チーム ----------
// 何年のドラフトで入った選手か、で絞り込む（'' = すべて、'none' = ドラフトの記録がない選手）
function draftYearMatch(p) {
  const f = UI.draftYearF;
  if (!f) return true;
  if (f === 'none') return !p.drafted;
  return !!p.drafted && p.drafted.year === +f;
}
function draftYearFilter(ps) {
  const years = [...new Set(ps.filter(p => p.drafted).map(p => p.drafted.year))].sort((a, b) => b - a);
  if (UI.draftYearF && UI.draftYearF !== 'none' && !years.includes(+UI.draftYearF)) UI.draftYearF = '';
  const n = f => ps.filter(p => (f === 'none' ? !p.drafted : p.drafted && p.drafted.year === f)).length;
  return `<div class="row" style="justify-content:flex-start"><label>入団：<select data-chg="draftYearF">
    <option value="">すべての選手</option>
    ${years.map(y => `<option value="${y}" ${String(y) === String(UI.draftYearF) ? 'selected' : ''}>${y}年ドラフト（${n(y)}人）</option>`).join('')}
    <option value="none" ${UI.draftYearF === 'none' ? 'selected' : ''}>ドラフト以外（ゲーム開始前・外国人など）（${n('none')}人）</option>
  </select></label></div>`;
}

function renderTeam() {
  const t = S.teams[UI.viewTeam != null ? UI.viewTeam : S.myTeamId];
  const ps = teamPlayers(t);
  const act = p => (t.active.includes(p.id) ? 0 : p.on40 ? 1 : 2);
  const bats = ps.filter(canBat).sort((a, b) => act(a) - act(b) || FPOS.indexOf(a.pos) - FPOS.indexOf(b.pos) || ovr(b) - ovr(a));
  const roleOrder = ['先発', '抑え', 'セットアッパー', '中継'];
  const pits = ps.filter(canPitch).sort((a, b) => act(a) - act(b) || roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || ovr(b) - ovr(a));
  const g = UI.posf.team;
  const showBat = !g || (g !== '先発' && g !== '中継ぎ');
  const showPit = !g || g === '先発' || g === '中継ぎ';
  const geniuses = t.id === S.myTeamId ? ps.filter(p => p.geniusKnown) : [];
  const sel = `<select data-chg="viewTeam">${LEAGUES.flatMap(lg => DIVS.map(dv => [lg, dv])).map(([lg, dv]) => `<optgroup label="${divName(lg, dv)}">${S.teams.filter(x => x.lg === lg && x.div === dv).map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${h(x.name)}${x.id === S.myTeamId ? '（自分）' : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
  return `
  <section class="card">
    <div class="row"><h2>${teamChip(t)} ${h(t.name)}</h2>${sel}</div>
    <p class="muted">${divName(t.lg, t.div)} ・ 市場 ${t.mk} ・ 全体 ${ps.length}人 ・ 40人枠 ${count40(t)}人 ・ 26人枠 ${t.active.length}人 ・ 40人枠の年俸の合計 ${U.money(payroll40(t))} ・ 名前を押すと詳しく見られます</p>
    <div class="seg">${[['list', '選手一覧'], ['stats', '今季の成績'], ['pay', '年俸']].map(([k, n]) => `<button class="${UI.teamView === k ? 'on' : ''}" data-act="teamView" data-k="${k}">${n}</button>`).join('')}</div>
    ${posFilter('team')}
    ${draftYearFilter(ps)}
    ${UI.teamView === 'pay' ? payTable(t, ps.filter(p => (showBat && canBat(p) && posMatch(p, g)) || (showPit && canPitch(p) && posMatch(p, g))).filter(draftYearMatch))
      : UI.teamView === 'stats' ? teamStats(t, g, showBat, showPit) : `${showBat ? `<h3>野手${g ? `（${g}）` : ''}</h3>${batTable(bats.filter(p => posMatch(p, g) && draftYearMatch(p)))}` : ''}
    ${showPit ? `<h3>投手${g ? `（${g}）` : ''}</h3>${pitTable(pits.filter(p => posMatch(p, g) && draftYearMatch(p)))}` : ''}`}
  </section>
  ${t.id === S.myTeamId ? `<section class="card genius-box"><h2>✨ 天才</h2>
    ${geniuses.length ? `<p>${geniuses.map(p => `${nameCell(p)}（${posBadge(p)}・${p.age}歳・総合${Math.round(ovr(p))}）`).join('　')}</p>`
      : '<p class="muted">いまはいません。天才は伸びが段ちがいの選手で、自分のチームで 1 年過ごすと分かります。</p>'}
  </section>` : ''}`;
}

// 才能の★。隠している選手は「？」（ドラフト候補と入団してまもない選手）
function potLabel(p) { return potHidden(p) ? '<span class="muted" title="入団して数年は才能が分かりません">？</span>' : potStars(p.pot); }

// FA の年俸を打つ箱（万ドル）。横に、相場の何倍かを出す
function payInput(chg, pid, v, mv) {
  return `<input type="number" class="pay" data-chg="${chg}" data-pid="${pid}" value="${v}" min="${Math.ceil(mv * FA_PAY_MIN)}" step="10" inputmode="numeric" placeholder="提示しない">万ドル
    ${v ? `<span class="muted small">${U.money(v)}・相場×${(v / mv).toFixed(2)}</span>` : ''}`;
}

// ---------- 年俸の一覧（人の言葉 2026-11-11「年俸を見れる一覧がない」） ----------
function payTable(t, list) {
  const rank = S.teams.map(x => payroll40(x)).sort((a, b) => b - a).indexOf(payroll40(t)) + 1;
  const avg = U.sum(S.teams, x => payroll40(x)) / S.teams.length;
  const ps = list.slice().sort((a, b) => b.salary - a.salary);
  const after = S.phase !== 'season'; // 来季の見込みはシーズンが終わってから
  const rows = ps.map((p, i) => {
    const left = contractLeft(p);
    const next = left > 1 ? '<span class="muted">契約で同じ</span>' : after ? (() => { const v = renewSalary(p), d = v - p.salary;
      return `${U.money(v)} <span class="${d < 0 ? 'neg' : 'muted'} small">${d >= 0 ? '+' : ''}${Math.round(d / Math.max(1, p.salary) * 100)}%</span>`; })() : '<span class="muted">-</span>';
    return `<tr><td>${i + 1}</td><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td>${p.age}</td><td>${Math.round(ovr(p))}</td>
      <td><b>${p.on40 ? U.money(p.salary) : '<span class="muted">マイナー</span>'}</b></td><td class="nowrap">${left > 0 ? `あと${left}年` : p.on40 ? contractStage(p) : '-'}</td><td class="nowrap small">${svcText(p)}</td><td class="nowrap">${p.on40 ? next : ''}</td></tr>`;
  }).join('');
  const line = luxLine(S.year), pay = payroll40(t);
  return `<p>40人枠の年俸の合計 <b>${U.money(pay)}</b>（30 球団で ${rank} 位・平均 ${U.money(avg)}）・ ぜいたく税の線 ${U.money(line)}${pay > line ? ` <span class="neg">（${U.money(pay - line)} 超えています）</span>` : `（あと ${U.money(line - pay)}）`}</p>
    <div class="scroll"><table class="tbl"><tr><th>#</th><th>名前</th><th>守</th><th>年</th><th>総合</th><th>年俸</th><th>契約</th><th>メジャー</th><th>来季の見込み</th></tr>${rows}</table></div>
    <p class="muted small">メジャーの年数（サービスタイム）が 3 年未満は「調停前」、3〜6 年は「調停」、6 年で FA 権。来季の見込みは、シーズンが終わると出ます。</p>`;
}

// ---------- 今季の成績（チームの選手の一覧） ----------
const r3 = v => (isFinite(v) ? v.toFixed(3).replace(/^0/, '') : '-');
const BAT_COLS = [
  ['g', '試合', s => s.g], ['pa', '打席', s => s.pa], ['ab', '打数', s => s.ab], ['h', '安打', s => s.h],
  ['d', '二塁打', s => s.d], ['t', '三塁打', s => s.t], ['hr', '本塁打', s => s.hr], ['rbi', '打点', s => s.rbi],
  ['r', '得点', s => s.r], ['sb', '盗塁', s => s.sb], ['bb', '四球', s => s.bb], ['k', '三振', s => s.k],
  ['avg', '打率', s => (s.ab ? s.h / s.ab : -1), r3], ['obp', '出塁率', s => (s.pa ? (s.h + s.bb) / s.pa : -1), r3],
  ['slg', '長打率', s => (s.ab ? (s.h + s.d + s.t * 2 + s.hr * 3) / s.ab : -1), r3], ['ops', 'OPS', s => (s.pa ? ops(s) : -1), r3],
];
const PIT_COLS = [
  ['pg', '登板', s => s.pg], ['gs', '先発', s => s.gs], ['w', '勝', s => s.w], ['l', '敗', s => s.l], ['sv', 'S', s => s.sv],
  ['ip', '投球回', s => s.outs, v => U.ip(v)], ['ph', '被安打', s => s.ph], ['phr', '被本塁打', s => s.phr], ['pbb', '四球', s => s.pbb],
  ['pk', '奪三振', s => s.pk], ['per', '失点', s => s.per],
  ['era', '防御率', s => (s.outs ? s.per * 27 / s.outs : 99), v => (v >= 99 ? '-.--' : v.toFixed(2))],
  ['whip', 'WHIP', s => (s.outs ? (s.ph + s.pbb) * 3 / s.outs : 99), v => (v >= 99 ? '-' : v.toFixed(2))],
  ['k9', '奪三振率', s => (s.outs ? s.pk * 27 / s.outs : -1), v => (v < 0 ? '-' : v.toFixed(2))],
];
// 小さいほうが良い数字は、小さい順に並べる
const LOW_IS_GOOD = new Set(['era', 'whip', 'per', 'ph', 'phr', 'pbb', 'l', 'k']);

function statTable(kind, list, gp) {
  const cols = kind === 'bat' ? BAT_COLS : PIT_COLS;
  const key = UI.statSort[kind];
  const col = cols.find(c => c[0] === key) || cols[0];
  const qual = p => (kind === 'bat' ? p.stats.pa >= gp * 3.1 : p.stats.outs >= gp * 3);
  // 率の並べ替えは、規定に届いた選手を先に
  const isRate = ['avg', 'obp', 'slg', 'ops', 'era', 'whip', 'k9'].includes(key);
  const rows = list.slice().sort((a, b) => (isRate ? qual(b) - qual(a) : 0)
    || (LOW_IS_GOOD.has(key) ? col[2](a.stats) - col[2](b.stats) : col[2](b.stats) - col[2](a.stats)));
  const fmt = c => c[3] || (v => v);
  return `<div class="scroll"><table class="tbl stats"><tr><th>名前</th><th>守</th>${cols.map(c => `<th><a href="#" class="sorth ${c[0] === key ? 'on' : ''}" data-act="statSort" data-kind="${kind}" data-k="${c[0]}">${c[1]}${c[0] === key ? (LOW_IS_GOOD.has(key) ? '▲' : '▼') : ''}</a></th>`).join('')}</tr>
    ${rows.map(p => `<tr class="${qual(p) ? 'qual' : ''}"><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td>${cols.map(c => `<td class="${c[0] === key ? 'sortcol' : ''}">${fmt(c)(c[2](p.stats))}</td>`).join('')}</tr>`).join('')}
  </table></div>`;
}

function teamStats(t, g, showBat, showPit) {
  const gp = Math.max(1, gamesPlayed(t));
  const ps = teamPlayers(t).filter(p => posMatch(p, g) && draftYearMatch(p));
  const bats = ps.filter(p => canBat(p) && p.stats.pa > 0);
  const pits = ps.filter(p => canPitch(p) && p.stats.pg > 0);
  const S0 = list => list.reduce((a, p) => { Object.keys(p.stats).forEach(k => { a[k] = (a[k] || 0) + p.stats[k]; }); return a; }, {});
  const tb = S0(bats), tp = S0(pits);
  return `
    <p class="muted">見出しを押すと並べ替えます。色のついた行は規定（打席 ${Math.ceil(gp * 3.1)}・投球回 ${gp}）に届いている選手です。今季まだ出ていない選手は出していません。</p>
    ${showBat ? `<h3>打撃（${bats.length}人）　チーム打率 ${U.avg(tb.h || 0, tb.ab || 0)}・${tb.hr || 0}本塁打・${tb.sb || 0}盗塁</h3>${bats.length ? statTable('bat', bats, gp) : '<p class="muted">まだいません</p>'}` : ''}
    ${showPit ? `<h3>投球（${pits.length}人）　チーム防御率 ${U.era(tp.per || 0, tp.outs || 0)}・${tp.pk || 0}奪三振</h3>${pits.length ? statTable('pit', pits, gp) : '<p class="muted">まだいません</p>'}` : ''}`;
}

function batTable(list) {
  if (isMobile()) return cardList(list, p => playerCard(p, { sub: `<span class="muted">人気${Math.round(p.fame)} ・ ${U.money(p.salary)}</span>`, lines: `<div class="pc-line">${statLine(p)}</div>` }));
  return `<div class="scroll"><table class="tbl">
  <tr><th>名前</th><th>守</th><th>年</th><th>調</th>${BAT_KEYS.map(k => `<th>${BAT_LABEL[k]}</th>`).join('')}<th>弾</th><th>総合</th><th>人気</th>
  <th>試合</th><th>打率</th><th>本</th><th>点</th><th>盗</th><th>OPS</th><th>年俸</th></tr>
  ${list.map(p => {
    const s = p.stats;
    return `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${condCell(p)}</td>
    ${BAT_KEYS.map(k => `<td>${gradeCell(p.a[k])}</td>`).join('')}<td>${canBat(p) ? trajOf(p) : '-'}</td><td>${Math.round(ovr(p))}</td><td>${Math.round(p.fame)}</td>
    <td>${s.g}</td><td>${U.avg(s.h, s.ab)}</td><td>${s.hr}</td><td>${s.rbi}</td><td>${s.sb}</td><td>${s.pa ? ops(s).toFixed(3) : '-'}</td><td>${U.money(p.salary)}</td></tr>`;
  }).join('')}</table></div>`;
}

function pitTable(list) {
  if (isMobile()) return cardList(list, p => playerCard(p, { sub: `<span>${p.role || '-'}</span><span class="muted">人気${Math.round(p.fame)} ・ ${U.money(p.salary)}</span>`, lines: `<div class="pc-line">${statLine(p)}</div>` }));
  return `<div class="scroll"><table class="tbl">
  <tr><th>名前</th><th>役割</th><th>年</th><th>調</th><th>球速</th>${PIT_KEYS.slice(1).map(k => `<th>${PIT_LABEL[k]}</th>`).join('')}<th>球種</th><th>総合</th><th>人気</th>
  <th>登板</th><th>勝</th><th>敗</th><th>S</th><th>防御率</th><th>回</th><th>三振</th><th>年俸</th></tr>
  ${list.map(p => {
    const s = p.stats;
    return `<tr><td class="l">${nameCell(p)}</td><td class="nowrap">${p.role || '-'} ${aptBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${condCell(p)}</td>
    <td class="num">${veloKmh(p.a.velo)}km</td>${PIT_KEYS.slice(1).map(k => `<td>${gradeCell(p.a[k])}</td>`).join('')}${pitchCell(p)}<td>${Math.round(ovr(p))}</td><td>${Math.round(p.fame)}</td>
    <td>${s.pg}</td><td>${s.w}</td><td>${s.l}</td><td>${s.sv}</td><td>${U.era(s.per, s.outs)}</td><td>${U.ip(s.outs)}</td><td>${s.pk}</td><td>${U.money(p.salary)}</td></tr>`;
  }).join('')}</table></div>`;
}

function growthBox(p) {
  const g = growthSpan(p), ph = growthPhase(p);
  const now = ph.k === 'grow' ? `あと${ph.left + 1}年はよく伸びます。`
    : ph.k === 'peak' ? (ph.left > 0 ? `あと${ph.left}年はピークが続き、${g.declineFrom}歳から衰え始めます。` : `来年（${g.declineFrom}歳）から衰え始めます。`)
      : `毎年オフに能力が少しずつ下がります（年を取るほど大きく）。`;
  return `<div class="growth"><p><b>${p.type}型</b> ・ 成長期 〜${g.growEnd}歳 ・ ピーク ${g.peakFrom}〜${g.peakTo}歳 ・ 衰退期 ${g.declineFrom}歳〜
    ・ いま <span class="phase ph-${ph.k}">${ph.name}</span> ${now}</p>${growthBar(p)}</div>`;
}

const TRAJ_WORD = ['', 'ライナー・ゴロが多い', 'やや低め', 'やや高め', '高く上がるアーチスト'];

// 年度別の成績表（選手の詳細と、引退する永久欠番の候補で使う）
function careerTables(rows, total, bat, pit, twoWay) {
  const crow = (c, isP) => {
    const s = c.s;
    return isP
      ? `<tr><td>${c.y}${c.now ? '（今季）' : ''}</td><td>${h(c.t)}</td><td>${s.pg}</td><td>${s.w}</td><td>${s.l}</td><td>${s.sv}</td><td>${U.era(s.per, s.outs)}</td><td>${U.ip(s.outs)}</td><td>${s.pk}</td></tr>`
      : `<tr><td>${c.y}${c.now ? '（今季）' : ''}</td><td>${h(c.t)}</td><td>${s.g}</td><td>${U.avg(s.h, s.ab)}</td><td>${s.h}</td><td>${s.hr}</td><td>${s.rbi}</td><td>${s.sb}</td><td>${s.pa ? ops(s).toFixed(3) : '-'}</td></tr>`;
  };
  const totalRow = isP => (rows.length > 1 ? crow({ y: '通算', t: '', s: total }, isP).replace('<tr>', '<tr class="total">') : '');
  const headP = '<tr><th>年</th><th>球団</th><th>登板</th><th>勝</th><th>敗</th><th>S</th><th>防御率</th><th>回</th><th>三振</th></tr>';
  const headB = '<tr><th>年</th><th>球団</th><th>試合</th><th>打率</th><th>安打</th><th>本</th><th>点</th><th>盗</th><th>OPS</th></tr>';
  return `${bat ? `<h3>成績${twoWay ? '（打撃）' : ''}</h3><div class="scroll"><table class="tbl">${headB}${rows.map(c => crow(c, false)).join('')}${totalRow(false)}</table></div>` : ''}
  ${pit ? `<h3>成績${twoWay ? '（投球）' : ''}</h3><div class="scroll"><table class="tbl">${headP}${rows.map(c => crow(c, true)).join('')}${totalRow(true)}</table></div>` : ''}`;
}
// 引退・退団の欄に出す強さ（守備位置・総合・能力）
function retireStrength(r) {
  if (r.ovr == null) return '';
  const abil = r.abil.map(([k, v]) => `${SHORT_LABEL[k]}${k === 'velo' ? veloKmh(v) + 'km' : `<span class="g g${U.grade(v)}">${U.grade(v)}</span>`}`).join(' ');
  const pit = r.pit ? ' ' + r.pit.map(([t, v]) => `${PITCHES[t].short}${v}`).join(' ') : '';
  return `　<span class="small">${h(r.pos)} 総合<b>${r.ovr}</b> ${abil}${pit}</span>`;
}
// 引退・退団の欄の慰留ボタン
function retainCell(r, i, c) {
  if (!r.can) return '';
  if (r.res === 'stay') return '　<b>→ 慰留に応じて、現役を続けます</b>';
  if (r.res === 'no') return '　<span class="muted">→ 慰留を断りました</span>';
  const p = S.players[r.pid];
  if (!p) return '';
  if ((c.honor || []).some(x => x.name === r.name && x.done)) return '';
  const v = retainChance(p);
  return `　<button class="sm" data-act="retain" data-i="${i}">慰留する</button> <span class="muted small">見込み：${v >= 0.6 ? '高い' : v >= 0.35 ? '五分' : '低い'}・忠誠心 ${Math.round(p.loyalty || 0)}</span>`;
}
// 永久欠番の候補（もう引退して選手はいない）：引退のときに残した成績を見せる
function renderHonorModal(x) {
  const c = x.card;
  if (!c) return `<h2>#${x.no} ${h(x.name)}</h2><p class="muted">この候補の成績は残っていません。</p>`;
  return `<h2>#${x.no} ${h(x.name)} <span class="muted small">${h(c.pos)}・${x.years}年在籍・${c.age}歳で引退</span></h2>
    ${c.ms.length ? `<div class="atitle">${c.ms.map(h).join('・')}</div>` : ''}
    ${c.honors.length ? `<p>${c.honors.map(h).join('　')}</p>` : ''}
    ${c.titles.length ? `<p class="muted small">🏆 ${c.titles.map(h).join('、')}</p>` : ''}
    ${careerTables(c.rows, c.total, c.bat, c.pit, c.twoWay)}`;
}
function renderPlayerModal(p) {
  const mine = p.teamId === S.myTeamId;
  const keys = abilKeys(p), lbl = ALL_LABEL;
  const bars = keys.map(k => `<div class="bar"><span class="bl">${lbl[k]}</span>${abilStalled(p, k) ? `<span class="gstack"><span class="grow1">${gradeCell(p.a[k])}</span><small class="stall" title="伸びしろの上限に近く、練習してもほとんど伸びない">停滞</small></span>` : gradeCell(p.a[k])}
    <span class="bt"><span style="width:${Math.round(p.a[k] / ABIL_MAX * 100)}%"></span></span>${k === 'velo' ? `<span class="muted">${veloKmh(p.a.velo)}km/h</span>` : ''}</div>`).join('')
    + (canPitch(p) ? (p.noise ? `<div class="bar"><span class="bl">持ち球</span><span>${pitchList(p)} ${kireTag(p)} <span class="muted small">${pitchStyle(p)}</span></span></div>`
      : pitchesOf(p).map(t => `<div class="bar"><span class="bl">${PITCHES[t].name}</span>${abilStalled(p, t) ? `<span class="gstack"><span class="grow1"><b>${pitchLevel(p, t)}</b></span><small class="stall" title="伸びしろの上限に近く、練習してもほとんど伸びない">停滞</small></span>` : `<b>${pitchLevel(p, t)}</b>`}
        <span class="bt"><span style="width:${Math.round(pitchVal(p, t) / ABIL_MAX * 100)}%"></span></span></div>`).join('') + `<div class="bar"><span class="bl">変化</span>${pitchChart(p)}</div><div class="bar"><span class="bl">投球</span><span class="tag">${pitchStyle(p)}</span></div>`) : '')
    + (canBat(p) ? `<div class="bar"><span class="bl">弾道</span>${trajTag(p, true)}<span class="muted small">${TRAJ_WORD[trajOf(p)]}</span></div>
      <div class="bar"><span class="bl">選球眼</span>${eyeTag(p) || '<span class="muted small">ふつう</span>'}</div>
      <div class="bar"><span class="bl">盗塁</span><span class="tag steal s-${stealWord(p)}">${stealWord(p)}</span><span class="muted small">${stealWord(p) === '積極的' ? 'すきがあればどんどん走る' : stealWord(p) === '慎重' ? 'あまり走らない' : ''}</span></div>` : '');
  const careerRows = [...p.career, { y: S.year, t: p.teamId != null ? S.teams[p.teamId].short : '-', s: p.stats, now: true }]
    .filter((c, i, arr) => !(c.now && arr.some(x => !x.now && x.y === S.year)));
  const titles = titlesOf(p.id);
  const focusOpts = focusOptions(p).map(f => `<option ${p.focus === f ? 'selected' : ''}>${f}</option>`).join('');
  const team = p.teamId != null ? S.teams[p.teamId] : null;
  return `
  <h2>${p.no != null && team ? `<span class="muted">#${p.no}</span> ` : ''}${h(p.name)} <span class="muted small">${h(p.nat || '')}</span></h2>
  <p>${team ? teamChip(team) : ''} ${p.twoWay ? `二刀流（投手：${p.role || '-'}・野手：${p.isP ? p.pos2 : p.pos}）` : p.isP ? `投手（${p.role}）` : `野手（${p.pos}）`}・${handText(p)} ${posBadge(p)}${canBat(p) ? ` ・ サブポジ ${subsOf(p).length ? subsOf(p).join('・') : 'なし'}` : ''} ・ ${p.age}歳 ・ ${p.type}型 ・ 才能 <span class="stars">${potLabel(p)}</span>${potHidden(p) && p.hint ? `（入団時の講評：${h(p.hint)}）` : ''}
   ・ 調子 ${condCell(p)} ${COND_LABEL[p.cond]} ・ 年俸 ${U.money(p.salary)} ${p.inj ? `<span class="tag bad">故障 残り${p.inj}日</span>` : ''}${p.awakened ? `<span class="tag awaken-tag">覚醒×${p.awakened}</span>` : ''}${p.bigAwakened ? `<span class="tag awaken-tag big">大覚醒×${p.bigAwakened}</span>` : ''}${p.limitBroken ? `<span class="tag awaken-tag">上限解放×${p.limitBroken}</span>` : ''}${p.b9 ? `<span class="tag">ベストナイン×${p.b9}</span>` : ''}${p.gg ? `<span class="tag">名手賞×${p.gg}</span>` : ''}${p.as ? `<span class="tag">オールスター×${p.as}</span>` : ''}${p.asMvp ? `<span class="tag">球宴MVP×${p.asMvp}</span>` : ''}${Object.keys(p.fx || {}).map(k => `<span class="tag awaken-tag">${k === 'k' ? `${FEAT_K}奪三振以上` : FEAT_WORD[k]}×${p.fx[k]}</span>`).join('')}${team && grumbling(team, p) ? '<span class="tag bad">起用に不満</span>' : ''}</p>
  ${growthBox(p)}
  <div class="bars">${bars}</div>
  <p>総合 <b>${Math.round(ovr(p))}</b>　トレード価値 ${tradeValue(p).toLocaleString()}</p>
  <p class="drafted">${p.drafted
    ? `📝 入団：<b>${p.drafted.round ? `${p.drafted.year}年ドラフト${p.drafted.round}巡目${p.drafted.no ? `（全体${p.drafted.no}番）` : ''}` : `${p.drafted.year}年 ${h(p.drafted.note || '国際アマ')}`}</b>（${h(p.drafted.team)}${p.drafted.round && p.drafted.note ? `・${h(p.drafted.note)}` : ''}）${p.rareYears ? ` <span class="muted">「${p.rareYears}年に一人の逸材」と言われた</span>` : ''}${p.drafted.from ? ` <span class="muted">${h(p.drafted.from)}から</span>` : ''}`
    : p.kind === 'アジア' ? `📝 入団：アジアのプロからポスティング（${h(p.amateur ? p.amateur.team : '')}）` : '<span class="muted">📝 入団：ゲームを始める前からいる選手（ドラフトの記録なし）</span>'}</p>
  <p>出身 ${p.home ? h(p.home) : '-'}${team && isHomeTeam(p, team) ? ' <span class="tag">地元</span>' : ''}
    ・ メジャーの年数 <b>${svcText(p)}</b>（${contractStage(p)}${hasFA(p) ? '' : `・FA 権まであと${Math.max(0, FA_YEARS - (p.svc || 0)).toFixed(1)}年`}）
    ${underContract(p) ? ` ・ 契約 あと${contractLeft(p)}年（年俸固定）` : ''}${p.on40 ? ` ・ オプション 残り${optionsLeft(p)}${p.optYear === S.year ? '（今季使用）' : ''}` : ' ・ マイナー契約'}
    ${p.signYear != null && !p.on40 ? ` ・ ルール5：${r5Eligible(p) ? '<b class="neg">対象</b>（40人枠に入れないと取られることがある）' : `${S.year - p.signYear + 1}回目／${(p.signAge || 20) <= 18 ? R5_YOUNG : R5_OLD}回目から対象`}` : ''}</p>
  ${p.mst ? `<p class="muted">今季のマイナー（${h(p.mst.lvl)}）：${p.mst.ab ? `${p.mst.g}試合 打率${U.avg(p.mst.h, p.mst.ab)} ${p.mst.hr}本` : ''}${p.mst.ab && p.mst.outs ? ' ／ ' : ''}${p.mst.outs ? `投球回${U.ip(p.mst.outs)} 防御率${U.era(p.mst.er, p.mst.outs)} ${p.mst.k}奪三振` : ''}</p>` : ''}
  <div class="bars">
    <div class="bar"><span class="bl">人気度</span><small class="num">${Math.round(p.fame)}</small><span class="bt"><span class="fame" style="width:${Math.round(p.fame)}%"></span></span></div>
    <div class="bar"><span class="bl">忠誠心</span><small class="num">${Math.round(p.loyalty)}</small><span class="bt"><span class="loyal" style="width:${Math.round(p.loyalty)}%"></span></span></div>
    <div class="bar"><span class="bl">ビジュアル</span><span class="stars">${visualStars(p.visual)}</span></div>
  </div>
  ${careerTables(careerRows, careerTotal(p), canBat(p), canPitch(p), p.twoWay)}
  ${titles.length ? `<p>🏆 タイトル：${titles.map(t => `${t.year} ${h(t.title)}`).join('、')}</p>` : ''}
  ${p.amateur ? `<p class="muted">アマ時代：${h(p.amateur.team)} ・ ${h(p.amateur.line)}${p.amateur.title ? ` ・ 🏆 ${h(p.amateur.title)}` : ''}</p>` : ''}
  ${mine ? `<h3>監督の指示</h3>
    <p>${myTeam().active.includes(p.id)
      ? `<b>26人枠</b> <button data-act="demote" data-pid="${p.id}">マイナーへ下ろす</button> <span class="muted">${S.phase === 'season' ? `${canOption(p) ? `オプションを使います（残り${optionsLeft(p)}）。` : 'オプションが残っていないので、40人枠から外す（DFA）しかありません。'}下ろすと${rereg(p)}日間は戻せません` : ''}</span>`
      : `<b>${p.on40 ? '40人枠（マイナー）' : 'マイナー契約'}・${h(p.lvl || '3A')}</b> ${cannotPromote(myTeam(), p) ? `<span class="muted">26人枠に上げられません（${h(cannotPromote(myTeam(), p))}）</span>` : `<button class="primary" data-act="promote" data-pid="${p.id}">26人枠に上げる${p.on40 ? '' : '（40人枠にも入れる）'}</button>`}
        <label>階層 <select data-chg="lvl" data-pid="${p.id}">${MINOR_LEVELS.map(l => `<option ${(p.lvl || '3A') === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}</p>
    <p>${p.on40 ? `<button data-act="dfa" data-pid="${p.id}">40人枠から外す（DFA）</button> <span class="muted small">ウェーバーにかかり、ほかの球団が取らなければマイナー契約で残ります</span>`
      : `<button data-act="add40" data-pid="${p.id}" ${count40(myTeam()) < FORTY_MAX ? '' : 'disabled'}>40人枠に入れる</button> <span class="muted small">ルール5から守れます。年俸は最低年俸（${U.money(MIN_SALARY)}）から</span>`}</p>
    <p>練習の重点：<select data-chg="focus" data-pid="${p.id}">${focusOpts}</select></p>
    <p>${p.twoWay
      ? `<button data-act="dropTwoWay" data-pid="${p.id}">二刀流をやめる</button> <span class="muted">${p.isP ? '打撃' : '投球'}の能力がなくなり、本業に専念します</span>`
      : p.age <= 27 && ovr(p) < TWO_WAY_MIN_OVR ? `<span class="muted">二刀流に挑戦できるのは総合${TWO_WAY_MIN_OVR}以上の選手です（いま${Math.round(ovr(p))}）</span>`
      : p.age <= 27 ? `<button data-act="tryTwoWay" data-pid="${p.id}">二刀流に挑戦させる</button> <span class="muted">${p.isP ? '打撃' : '投球'}の練習を始めます（最初は低い能力から。練習の伸びは両方に分かれます）</span>` : ''}</p>
    ${underContract(p) ? '<p class="muted">契約の途中なので、自由契約にできません。トレードには出せます。</p>' : releaseOpen()
      ? `<p><button class="danger" data-act="release" data-pid="${p.id}">自由契約にする</button> <span class="muted">チームから外します。他球団に拾われることもあります</span></p>`
      : '<p class="muted">ポストシーズン中は自由契約にできません。</p>'}` : ''}
  ${S.freeAgents.includes(p.id) ? `<p><span class="tag">自由契約</span> 前所属 ${h(p.lastTeam || '-')} ・ 希望年俸 ${U.money(p.salary)}</p>` : ''}`;
}

// ---------- オーダー ----------
// 選ぶ欄の中にも能力を出す（ミB パA 走C 肩D 守C）
const abilText = (p, keys) => keys.map(k => (k === 'velo' ? `${veloKmh(p.a.velo)}km` : `${SHORT_LABEL[k]}${U.grade(p.a[k])}`)).join(' ');
const batOpt = f => `${h(f.name)}（${f.isP ? f.pos2 : f.pos}${subsOf(f).length ? '・' + subsOf(f).join('') : ''}）${abilText(f, BAT_KEYS)} 弾${trajOf(f)} 総${Math.round(batOvr(f))}${f.inj ? ' 故障' : ''}`;
const pitOpt = p => `${h(p.name)}（${abilText(p, PIT_KEYS)} 総${Math.round(ovr(p))}）${p.inj ? '故障' : ''}`;

// 26 人枠の控え・中継ぎを、能力つきの表で見せる
function benchTable(list) {
  if (isMobile()) return cardList(list, p => playerCard(p, { sub: `<span class="muted">打率${U.avg(p.stats.h, p.stats.ab)} ${p.stats.hr}本</span>` }));
  if (!list.length) return '<p class="muted">なし</p>';
  return `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>調</th>${BAT_KEYS.map(k => `<th>${BAT_LABEL[k]}</th>`).join('')}<th>弾</th><th>総合</th><th>打率</th><th>本</th></tr>
    ${list.map(p => `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${condCell(p)}</td>${BAT_KEYS.map(k => `<td>${gradeCell(p.a[k])}</td>`).join('')}<td>${canBat(p) ? trajOf(p) : '-'}</td>
      <td>${Math.round(batOvr(p))}</td><td>${U.avg(p.stats.h, p.stats.ab)}</td><td>${p.stats.hr}</td></tr>`).join('')}</table></div>`;
}
function penTable(list, t) {
  const role = p => (p.id === t.closer ? '抑え' : p.id === t.setup ? 'セットアッパー' : '中継ぎ');
  if (isMobile()) return cardList(list, p => playerCard(p, { sub: `<span>${role(p)}</span><span class="muted">${p.stats.pg}登板 防${U.era(p.stats.per, p.stats.outs)} ${p.stats.sv}S</span>` }));
  if (!list.length) return '<p class="muted">なし</p>';
  return `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>役割</th><th>年</th><th>調</th><th>球速</th>${PIT_KEYS.slice(1).map(k => `<th>${PIT_LABEL[k]}</th>`).join('')}<th>球種</th><th>総合</th><th>登板</th><th>防御率</th><th>S</th></tr>
    ${list.map(p => `<tr><td class="l">${nameCell(p)}</td><td class="nowrap">${role(p)} ${aptBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${condCell(p)}</td><td class="num">${veloKmh(p.a.velo)}km</td>
      ${PIT_KEYS.slice(1).map(k => `<td>${gradeCell(p.a[k])}</td>`).join('')}${pitchCell(p)}<td>${Math.round(ovr(p))}</td><td>${p.stats.pg}</td><td>${U.era(p.stats.per, p.stats.outs)}</td><td>${p.stats.sv}</td></tr>`).join('')}</table></div>`;
}

function renderOrder() {
  const t = myTeam();
  const fielders = activePlayers(t).filter(canBat).sort((a, b) => batOvr(b) - batOvr(a));
  const pitchers = activePlayers(t).filter(canPitch).sort((a, b) => ovr(b) - ovr(a));
  const inLine = new Set(t.lineup.map(s => s.pid));
  const bench = fielders.filter(p => !inLine.has(p.id));
  const pOpt = (cur, list) => list.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${pitOpt(p)}</option>`).join('');
  const rot = t.rotation.map((id, i) => `<tr><td>${i + 1}${i === t.rotIdx % t.rotation.length ? ' <span class="tag">次</span>' : ''}</td>
      <td class="l"><select data-chg="rot" data-i="${i}">${pOpt(id, pitchers)}</select></td>
      <td>${condCell(S.players[id])}</td><td class="num">${veloKmh(S.players[id].a.velo)}km</td>${PIT_KEYS.slice(1).map(k => `<td>${gradeCell(S.players[id].a[k])}</td>`).join('')}${pitchCell(S.players[id])}<td>${Math.round(ovr(S.players[id]))}</td><td>${S.players[id].rest >= STARTER_REST ? '◯' : `中${Math.max(0, S.players[id].rest - 1)}日`}</td>
      <td>${S.players[id].stats.w}-${S.players[id].stats.l}</td><td>${U.era(S.players[id].stats.per, S.players[id].stats.outs)}</td></tr>`).join('');
  const pen = pitchers.filter(p => !t.rotation.includes(p.id));
  return `
  <section class="card">
    <div class="row"><h2>打順と守備</h2><button data-act="autoOrder">おまかせで組む</button></div>
    <p class="muted">選手をタップして、もう一人をタップすると入れ替わります。打順どうしなら打順を、控えを選ぶとスタメンと交代します。守備図の位置をタップすると、選んだ選手がそこを守ります。適性△×は守備が弱くなります（26人枠とマイナーの入れ替えは「26人・40人枠」の画面で）。</p>
    ${orderBoard(t, bench)}
  </section>
  <section class="card">
    <h2>先発ローテーション（${ROTATION_SIZE}人）</h2>
    <p class="muted">5 人で回し、中 4 日あいていれば投げます。間が中 4 日より短いと次の人に飛ばします（だれもいなければ中 3 日まで詰めます）。</p>
    <div class="scroll"><table class="tbl"><tr><th>#</th><th>投手</th><th>調</th><th>球速</th>${PIT_KEYS.slice(1).map(k => `<th>${PIT_LABEL[k]}</th>`).join('')}<th>球種</th><th>総合</th><th>登板</th><th>勝敗</th><th>防御率</th></tr>${rot}</table></div>
    <h2>リリーフ</h2>
    <p>抑え（9回）：<select data-chg="closer"><option value="">なし</option>${pOpt(t.closer, pen.filter(p => p.id !== t.setup))}</select></p>
    <p>セットアッパー（8回）：<select data-chg="setup"><option value="">なし</option>${pOpt(t.setup, pen.filter(p => p.id !== t.closer))}</select></p>
    <p class="muted">3 点差以内でリードしている 8 回はセットアッパー、9 回は抑えが出ます。リリーフは 3 日続けては投げません。</p>
    <h3>リリーフ陣（${pen.length}人）</h3>${penTable(pen.slice().sort((a, b) => (b.id === t.closer) - (a.id === t.closer) || (b.id === t.setup) - (a.id === t.setup) || relVal(b) - relVal(a)), t)}
  </section>`;
}

// ---------- オーダー画面（打順表と守備図） ----------
const FIELD_SPOT = { 捕: [50, 90], 一: [76, 58], 二: [63, 42], 三: [24, 58], 遊: [37, 42], 左: [16, 20], 中: [50, 9], 右: [84, 20] };
function posClass(pos) { return ['左', '中', '右'].includes(pos) ? '外' : pos; }

function fitTag(fit) { return fit >= SUB_FIT ? '<span class="tag">サブ</span>' : `<span class="tag ${fit < 0.7 ? 'bad' : ''}">適性${fit < 0.7 ? '×' : '△'}</span>`; }
function orderRow(p, o) {
  const fit = o.pos ? posFit(p, o.pos) : 1;
  return `<button class="po-row${o.sel ? ' sel' : ''}${p.inj ? ' inj' : ''}" data-act="osel" data-k="${o.k}" ${o.k === 'line' ? `data-i="${o.i}"` : `data-pid="${p.id}"`}>
    <span class="po-no">${o.k === 'line' ? o.i + 1 : ''}</span>
    <span class="po-pos">${o.pos ? `<span class="pb pb-${posClass(o.pos)}">${o.pos}</span>` : `<span class="pb pb-${p.isP ? p.pos2 : p.pos}">${p.isP ? p.pos2 : p.pos}</span>`}</span>
    <span class="po-name">${h(p.name)}${eyeTag(p)}<span class="po-can">${o.pos ? posBadge(p) : subsBadge(p)}</span>${fit < 1 ? fitTag(fit) : ''}${p.inj ? '<span class="tag bad">故障</span>' : ''}</span>
    <span class="po-cond">${condCell(p)}</span>
    <span class="po-traj">${trajTag(p)}</span>
    ${BAT_KEYS.map(k => `<span class="po-g">${gradeCell(p.a[k])}</span>`).join('')}
    <span class="po-st muted">${U.avg(p.stats.h, p.stats.ab)} ${p.stats.hr}本</span>
  </button>`;
}

function orderBoard(t, bench) {
  if (UI.osel && UI.osel.k === 'bench' && !bench.some(p => p.id === UI.osel.pid)) UI.osel = null; // 控えから外れた選手は選びなおし
  const sel = UI.osel;
  const head = `<div class="po-row po-head"><span class="po-no">#</span><span class="po-pos">守</span><span class="po-name">選手</span><span class="po-cond">調</span><span class="po-traj">弾</span>${BAT_KEYS.map(k => `<span class="po-g">${SHORT_LABEL[k]}</span>`).join('')}<span class="po-st">打率 本</span></div>`;
  const lineRows = t.lineup.map((s, i) => orderRow(S.players[s.pid], { k: 'line', i, pos: s.pos, sel: sel && sel.k === 'line' && sel.i === i })).join('');
  const benchRows = bench.length
    ? bench.map(p => orderRow(p, { k: 'bench', sel: sel && sel.k === 'bench' && sel.pid === p.id })).join('')
    : '<p class="muted">なし</p>';
  const selPid = sel ? (sel.k === 'line' ? t.lineup[sel.i].pid : sel.pid) : null;
  const spot = (pos, xy) => {
    const s = t.lineup.find(x => x.pos === pos);
    const p = s && S.players[s.pid];
    const bad = p && posFit(p, pos) < SUB_FIT;
    return `<button class="fspot${p && p.id === selPid ? ' sel' : ''}${bad ? ' bad' : ''}" style="left:${xy[0]}%;top:${xy[1]}%" data-act="ofield" data-pos="${pos}">
      <span class="pb pb-${posClass(pos)}">${pos}</span><span class="fname">${p ? h(p.name.split(' ')[0]) : '空き'}</span></button>`;
  };
  const hasDH = t.lineup.some(x => x.pos === '指');
  const nextSp = t.rotation.length ? S.players[t.rotation[t.rotIdx % t.rotation.length]] : null;
  const field = `<div class="po-field">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M50 98 L2 50 A68 68 0 0 1 98 50 Z" fill="#3f8f3a"/>
      <path d="M50 96 L22 66 L50 38 L78 66 Z" fill="#c8945a"/>
      <path d="M50 90 L30 68 L50 47 L70 68 Z" fill="#4c9d45"/>
      <circle cx="50" cy="66" r="3.2" fill="#c8945a"/>
      <path d="M50 96 L2 50 M50 96 L98 50" stroke="#fff" stroke-width=".5" fill="none"/>
    </svg>
    ${Object.entries(FIELD_SPOT).map(([pos, xy]) => spot(pos, xy)).join('')}
    <div class="fmound">${nextSp ? `<span class="pb pb-投">投</span><span class="fname">${h(nextSp.name.split(' ')[0])}</span>` : ''}</div>
    ${hasDH ? spot('指', [86, 90]) : ''}
  </div>`;
  const hint = sel
    ? `<b>${h(S.players[selPid].name)}</b> を選んでいます。入れ替える相手か、守る位置をタップしてください。 <button class="sm" data-act="oclear">やめる</button>`
    : '選手をタップして選びます。';
  return `<div class="po-hint">${hint}</div>
  <div class="po-wrap">
    <div class="po-list">${head}${lineRows}<h3>控え（${bench.length}人）</h3>${benchRows}</div>
    ${field}
  </div>`;
}

// ---------- オフの FA ----------
// 補償で移ることになっている、これからのドラフトの指名権
function pickTradeList() {
  const list = (S.pickTrades || []).filter(x => x.team === S.myTeamId);
  if (!list.length) return '';
  const word = x => x.kind === 'comp' ? `補償の指名権（1 巡目のあと）をもらう（${h(x.name)}）` : x.kind === 'lose' ? `${x.round}巡目の指名権を失う（${h(x.name)}）` : x.kind === 'drop' ? `1 巡目の指名が ${LUX_PICK_DROP} 番下がる（ぜいたく税）` : `${x.round}巡目の指名権が 1 つ増える（${h(x.name)}）`;
  return `<h3>来年のドラフトで動く指名権</h3><ul>${list.map(x => `<li>${x.year}年：${word(x)}</li>`).join('')}</ul>`;
}
function renderFAStep() {
  const F = S.off.fa;
  const t = myTeam();
  if (F.stage === 'pre') {
    const mine = F.eligible.map(id => S.players[id]).filter(p => p && p.teamId === t.id).sort((a, b) => ovr(b) - ovr(a));
    const others = F.eligible.length - mine.length;
    const rows = mine.map(p => {
      const r = retainOffer(F.retain[p.id]);
      const c = declareChance(p, r);
      const mv = faMarket(p);
      return `<tr><td class="l">${nameCell(p)}${isHomeTeam(p, t) ? '<span class="tag">地元</span>' : ''}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${Math.round(ovr(p))}</td>
        <td>${U.money(p.salary)}</td><td>${U.money(mv)}</td><td>${Math.round(p.loyalty)}</td><td>${Math.round(playShare(p) * 100)}%</td><td><b>${r ? faMood(c) : '市場に出る'}</b></td>
        <td class="l nowrap">${payInput('retainPay', p.id, r ? retainSalary(p, r) : '', mv)}
          <select data-chg="retain" data-k="years" data-pid="${p.id}" ${r ? '' : 'disabled'}>${U.range(1, CONTRACT_YEARS_MAX).map(v => `<option value="${v}" ${r && r.years === v ? 'selected' : ''}>${v}年</option>`).join('')}</select></td>
        <td>${p.qoGot ? '<span class="muted small">前に出した</span>' : `<label><input type="checkbox" data-chg="qo" data-pid="${p.id}" ${F.qo[p.id] ? 'checked' : ''}> 出す</label><br><span class="muted small">受ける見込み ${Math.round(qoAccept(p, F.qoAmt) * 100)}%</span>`}</td></tr>`;
    }).join('');
    return `<section class="card"><h2>FA になる選手</h2>
      <p>メジャーの年数（サービスタイム）が <b>6 年</b>になり、契約が終わった選手は FA になります。ここで残ってほしい選手に条件を出せます。<b>忠誠心が高い選手ほど残りやすく</b>、地元の球団にも少し残りやすくなります。条件を出さなかった選手は、みんな FA 市場に出ます。</p>
      <p><b>クオリファイング・オファー（QO）</b>：1 年・<b>${U.money(F.qoAmt)}</b>（上位 ${QO_TOP} 人の年俸の平均）を出せます（1 人 1 回まで）。受けたら 1 年残り、断ってほかの球団と契約したら、<b>来年のドラフトで 1 巡目のあとの補償の指名権</b>がもらえます（取った球団は 2 巡目を失います）。</p>
      <p class="muted">残留の条件の年俸は万ドルで打ちます（相場の ${FA_PAY_MIN} 倍から。空にすると提示しない）。高い年俸・長い年数ほど残りやすく、歳を取った選手ほど長い契約を喜びます。他球団では ${others} 人が FA になります。</p>
      ${rows ? `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>総合</th><th>年俸</th><th>FA相場</th><th>忠誠心</th><th>出場</th><th>意向</th><th>残留の提示</th><th>QO</th></tr>${rows}</table></div>` : '<p>あなたのチームには FA になる選手がいません。</p>'}
      </section>
      <section class="card"><button class="primary big" data-act="faDeclare">FA 市場を開く ▶</button></section>`;
  }
  if (F.stage === 'market') {
    const rows = F.declared.map(d => {
      const p = S.players[d.pid];
      const from = S.teams[d.from];
      const my = F.myBids[d.pid];
      const dr = UI.faDraft[d.pid] || { mul: 1, years: p.age <= 30 ? 3 : 1 };
      return `<tr class="${my ? 'sel' : ''}"><td class="l">${nameCell(p)}${isHomeTeam(p, t) ? '<span class="tag">地元</span>' : ''}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${Math.round(ovr(p))}</td>
        <td>${teamChip(from)}</td><td>${d.qo ? '<span class="tag">QO</span>' : '-'}</td><td>${U.money(d.mv)}</td><td>${d.bids.length ? `${d.bids.length}球団` : 'なし'}</td>
        <td class="l nowrap">${my ? `<b>年俸${U.money(my.salary)}・${my.years}年</b> <button class="sm" data-act="faBidCancel" data-pid="${d.pid}">取り消す</button>` : `
          ${payInput('faPay', d.pid, Math.round(d.mv * dr.mul), d.mv)}
          <select data-chg="faYears" data-pid="${d.pid}">${U.range(1, CONTRACT_YEARS_MAX).map(v => `<option value="${v}" ${dr.years === v ? 'selected' : ''}>${v}年</option>`).join('')}</select>
          <button class="sm primary" data-act="faBid" data-pid="${d.pid}">${d.from === t.id ? '残留を申し込む' : '申し込む'}</button>`}</td></tr>`;
    }).join('');
    return `<section class="card"><h2>FA市場（${F.declared.length}人）</h2>
      <p>選手に条件（年俸と年数）を出せます。年俸は万ドルで打ちます（相場の ${FA_PAY_MIN} 倍から）。選手は、年俸・年数・チームの強さと人気・元の球団への忠誠心・地元かどうか・レギュラーになれそうかを比べて決めます。年を取った選手ほど長い契約を喜びます。</p>
      <p class="muted"><span class="tag">QO</span> の選手を取ると、来年のドラフトの 2 巡目の指名権を失います。取った選手は 40 人枠に入ります（いま ${count40(t)}/${FORTY_MAX}）。「他球団の関心」は手を挙げている球団の数です。資金 ${U.money(t.money)}・40人枠の年俸の合計 ${U.money(payroll40(t))}（ぜいたく税の線 ${U.money(luxLine(S.year + 1))}）</p>
      ${rows ? `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>総合</th><th>前所属</th><th>QO</th><th>相場</th><th>他球団の関心</th><th>あなたの条件</th></tr>${rows}</table></div>` : '<p>今年は FA 市場に出た選手がいません。</p>'}
      <button class="primary big" data-act="faResolve">交渉を締め切る（結果発表） ▶</button></section>`;
  }
  const rows = F.results.map(r => `<tr class="${r.to === t.id || r.from === t.id ? 'me' : ''}"><td class="l">${S.players[r.pid] ? nameCell(S.players[r.pid]) : h(r.name)}</td>
    <td>${teamChip(S.teams[r.from])}</td><td>→</td><td>${r.to != null ? teamChip(S.teams[r.to]) : '-'}</td><td>${h(r.note)}</td><td>${U.money(r.salary)}</td><td>${r.years ? r.years + '年' : '-'}</td><td>${r.bids}球団</td></tr>`).join('');
  return `<section class="card"><h2>FAの結果</h2>
    ${rows ? `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>元</th><th></th><th>先</th><th></th><th>年俸</th><th>年数</th><th>条件を出した</th></tr>${rows}</table></div>` : '<p>今年は FA の動きがありませんでした。</p>'}
    ${pickTradeList()}
    <button class="primary big" data-act="offNext">契約の手続き（ノンテンダー）へ ▶</button></section>`;
}

// ポスティングを願い出た選手（自分の球団は、認めるかどうかを選ぶ）

// このオフにメジャーへ行った選手


// ---------- 26 人枠・40 人枠・マイナー ----------
function renderRoster() {
  const t = myTeam();
  const act = activePlayers(t), down = teamPlayers(t).filter(p => !t.active.includes(p.id));
  if (UI.rsel != null && (!S.players[UI.rsel] || S.players[UI.rsel].teamId !== t.id)) UI.rsel = null;
  const sel = UI.rsel != null ? S.players[UI.rsel] : null;
  const selAct = sel && isActive(t, sel);
  const byOvr = (a, b) => ovr(b) - ovr(a);
  const row = p => {
    const on = sel && sel.id === p.id;
    const isDown = !isActive(t, p);
    const why = isDown ? cannotPromote(t, p) : null;
    const abil = abilKeys(p).map(k => `<span class="po-g">${SHORT_LABEL[k]}${k === 'velo' ? `<span class="kmh">${veloKmh(p.a.velo)}</span>` : `<span class="g g${U.grade(p.a[k])}">${U.grade(p.a[k])}</span>`}</span>`).join('');
    const opt = p.on40 ? `<span class="tag" title="40人枠の選手をマイナーへ下ろせる残りのシーズン">オ${p.optYear === S.year ? '（今季使用）' : optionsLeft(p)}</span>` : '';
    return `<button class="ro-row${on ? ' sel' : ''}${why && !/満員/.test(why) ? ' locked' : ''}" data-act="rsel" data-pid="${p.id}">
      <span class="ro-pos">${posBadge(p)}</span>
      <span class="ro-name">${h(p.name)}${eyeTag(p)}${p.twoWay ? '<span class="tag twoway">二刀流</span>' : ''}${isDown ? `<span class="tag farm">${p.lvl || '3A'}</span>` : ''}${opt}${p.r5 ? '<span class="tag">R5</span>' : ''}${p.inj ? `<span class="tag bad">${p.il60 ? '60日IL' : p.il ? 'IL' : '故障'}${p.inj}日</span>` : ''}${why && !/満員/.test(why) && !p.inj ? `<span class="tag">${h(why)}</span>` : ''}</span>
      <span class="ro-age">${p.age}${phaseMark(p)}</span>
      <span class="ro-cond">${condCell(p)}</span>
      <span class="ro-abil">${abil}${trajTag(p)}</span>
      <span class="ro-ovr">${Math.round(ovr(p))}</span>
    </button>`;
  };
  const group = (list, title) => `<h3>${title}（${list.length}人）</h3>${list.length ? list.sort(byOvr).map(row).join('') : '<p class="muted">なし</p>'}`;
  const f40down = down.filter(p => p.on40), minors = down.filter(p => !p.on40);
  const hint = sel
    ? `<b>${h(sel.name)}</b>（${selAct ? '26人枠' : sel.on40 ? '40人枠・マイナー' : 'マイナー契約'}）を選んでいます。${selAct ? 'マイナーの' : '26人枠の'}選手をタップすると入れ替わります。
       ${selAct ? `<button class="sm" data-act="demote" data-pid="${sel.id}">マイナーへ下ろすだけ</button>` : `<button class="sm primary" data-act="promote" data-pid="${sel.id}">26人枠に上げるだけ</button>`}
       <button class="sm" data-act="player" data-pid="${sel.id}">詳しく（40人枠の出し入れ・階層）</button>
       <button class="sm" data-act="rclear">やめる</button>`
    : '選手をタップして選び、反対側の選手をタップすると 26 人枠とマイナーが入れ替わります。';
  const prob = rosterProblem(t);
  return `
  <section class="card">
    <div class="row"><h2>26人枠・40人枠・マイナー</h2><button data-act="autoActive">26人枠をおまかせで組む</button></div>
    <p>26人枠 <b>${act.length}/${activeMax()}人</b>（投手${act.filter(p => p.isP && !p.twoWay).length}/${pMax()}・野手${act.filter(p => !p.isP).length}）・ 40人枠 <b>${count40(t)}/${FORTY_MAX}</b>${teamPlayers(t).some(p => p.il60) ? `（ほかに 60日IL ${teamPlayers(t).filter(p => p.il60).length}人）` : ''} ・ マイナー契約 ${minors.length}人 ・ 全体 ${t.players.length}/${ROSTER_MAX}</p>
    ${prob ? `<p class="neg">⚠️ ${h(prob)}</p>` : ''}
    <p class="muted">試合に出られるのは 26 人枠だけ（9 月からは 28 人・投手は ${P_MAX_SEPT} 人まで）。26 人枠に上げられるのは 40 人枠の選手で、マイナー契約の選手を上げると 40 人枠にも入ります。
      40 人枠の選手をマイナーへ下ろすと<b>オプション</b>を使います（${OPTION_YEARS} シーズンまで。同じシーズンなら何度でも）。オプションが残っていない選手は、40 人枠から外す（DFA）しかありません。
      下ろした選手は ${REREGISTER.B} 日（投手は ${REREGISTER.P} 日）たつまで戻せません。ケガをした 26 人枠の選手は負傷者リスト（IL）へ。${IL60_DAYS} 日より長いケガは 60 日の負傷者リストで、40 人枠に数えません。</p>
    <div class="po-hint">${hint}</div>
    <div class="ro-wrap">
      <div class="ro-col ro-act"><h2>26人枠</h2>${group(act.filter(p => p.isP), '投手')}${group(act.filter(p => !p.isP), '野手')}</div>
      <div class="ro-col ro-farm"><h2>マイナー</h2>${group(f40down.filter(p => p.isP), '40人枠の投手')}${group(f40down.filter(p => !p.isP), '40人枠の野手')}
        ${MINOR_LEVELS.map(lv => group(minors.filter(p => (p.lvl || '3A') === lv), `マイナー契約・${lv}`)).join('')}</div>
    </div>
  </section>`;
}

// ---------- 練習 ----------
function renderTrain() {
  const t = myTeam();
  const ps = teamPlayers(t).sort((a, b) => a.isP - b.isP || a.age - b.age);
  const mult = INTENSITY[t.intensity].grow * (0.8 + t.fac.train * 0.1);
  return `
  <section class="card">
    <h2>練習方針</h2>
    <p>毎週月曜に練習の成果が出ます。マイナーの 25 歳以下は、階層に合った相手と戦って伸びやすくなります（3A ほど伸びやすいが、力が足りないと伸びが落ちます）。まれに選手が<b>覚醒</b>して大きく伸びることもあります。若い選手・才能（★）の多い選手ほど伸びます。</p>
    <div class="seg">${Object.keys(INTENSITY).map(k => `<button class="${t.intensity === k ? 'on' : ''}" data-act="intensity" data-k="${k}">${k}</button>`).join('')}</div>
    <p class="muted">軽め：伸びは小さいが調子が上がりやすく、ケガも少ない ／ 猛練習：よく伸びるがケガと不調が増える
      ／ いまの伸び倍率 ×${mult.toFixed(2)}（練習施設 Lv${t.fac.train}）</p>
  </section>
  <section class="card">
    <h2>選手ごとの重点</h2>
    <div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>型</th><th>才能</th><th>総合</th><th>重点</th></tr>
    ${ps.map(p => `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${p.type}</td><td class="stars">${potLabel(p)}</td><td>${Math.round(ovr(p))}</td>
      <td><select data-chg="focus" data-pid="${p.id}">${focusOptions(p).map(f => `<option ${p.focus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></td></tr>`).join('')}
    </table></div>
  </section>`;
}

// ---------- 日程 ----------
function renderSched() {
  const t = myTeam();
  const done = S.myGames.slice().reverse().map(g => {
    const o = S.teams[g.opp];
    return `<tr><td>${h(g.day)}</td><td>${teamChip(o)}${g.inter ? '<span class="tag">交流戦</span>' : ''}</td><td>${g.home ? 'ホーム' : 'ビジター'}</td><td class="${g.r === '勝' ? 'win' : g.r === '敗' ? 'lose' : ''}">${g.r}</td><td>${g.my} - ${g.op}</td>
    <td class="l muted">勝 ${h(g.wp || '-')} / 負 ${h(g.lp || '-')}${g.sp ? ` / S ${h(g.sp)}` : ''}</td></tr>`;
  }).join('');
  const up = [];
  if (S.phase === 'season') {
    for (let d = S.day; d < Math.min(S.schedule.length, S.day + 14); d++) {
      const e = S.schedule[d];
      const m = e.games.find(x => x.home === t.id || x.away === t.id);
      if (!m) { up.push(`<tr class="muted"><td>${dateLabel(e)}</td><td colspan="2">${e.allstar ? '⭐ オールスター' : e.draft ? '📝 ドラフト会議' : '休み'}</td></tr>`); continue; }
      up.push(`<tr><td>${dateLabel(e)}</td><td>${teamChip(S.teams[m.home === t.id ? m.away : m.home])}${m.inter ? '<span class="tag">交流戦</span>' : ''}</td><td>${m.home === t.id ? 'ホーム' : 'ビジター'}</td></tr>`);
    }
  }
  const last10 = S.myGames.slice(-10).map(g => g.r).join('');
  const inter = S.myGames.filter(g => g.inter);
  return `
  <div class="grid2">
    <section class="card"><h2>これからの試合</h2>${up.length ? `<table class="tbl"><tr><th>日付</th><th>相手</th><th></th></tr>${up.join('')}</table>` : '<p>ありません</p>'}</section>
    <section class="card"><h2>直近10試合</h2><p class="big-text">${last10 || '-'}</p>
      <h3>相手別</h3>${vsTable()}
      <p>交流戦 ${inter.filter(g => g.r === '勝').length}勝${inter.filter(g => g.r === '敗').length}敗${inter.filter(g => g.r === '分').length}分</p></section>
  </div>
  <section class="card"><h2>結果</h2><div class="scroll"><table class="tbl"><tr><th>日付</th><th>相手</th><th></th><th></th><th>スコア</th><th>投手</th></tr>${done || '<tr><td colspan="6">まだ試合をしていません</td></tr>'}</table></div></section>`;
}

function vsTable() {
  const rows = S.teams.filter(t => t.id !== S.myTeamId).sort((a, b) => (a.lg !== myTeam().lg) - (b.lg !== myTeam().lg)).map(o => {
    const gs = S.myGames.filter(g => g.opp === o.id);
    const w = gs.filter(g => g.r === '勝').length, l = gs.filter(g => g.r === '敗').length;
    return `<tr><td>${teamChip(o)}</td><td>${w}勝${l}敗</td></tr>`;
  }).join('');
  return `<table class="tbl">${rows}</table>`;
}

// ---------- 順位・成績 ----------
function standTable(st, small) {
  return `<div class="scroll"><table class="tbl">
  <tr><th>順</th><th>球団</th><th>試合</th><th>勝</th><th>敗</th><th>勝率</th><th>差</th>${small ? '' : '<th>得点</th><th>失点</th><th>人気</th>'}</tr>
  ${st.map((r, i) => `<tr class="${r.t.id === S.myTeamId ? 'me' : ''}"><td>${i + 1}</td><td class="l">${teamChip(r.t)} ${small ? '' : h(r.t.name)}</td>
    <td>${r.t.w + r.t.l + r.t.d}</td><td>${r.t.w}</td><td>${r.t.l}</td><td>${pct(r.t).toFixed(3).replace(/^0/, '')}</td><td>${i ? r.gb.toFixed(1) : '-'}</td>
    ${small ? '' : `<td>${r.t.rs}</td><td>${r.t.ra}</td><td>${Math.round(r.t.pop)}</td>`}</tr>`).join('')}
  </table></div>`;
}

function renderStand() {
  if (!UI.lg) UI.lg = myTeam().lg;
  const lg = UI.lg;
  const ls = leaders(lg);
  const gp = Math.max(1, gamesPlayed(S.teams.find(t => t.lg === lg)));
  const hist = S.history.length ? `<table class="tbl"><tr><th>年</th><th>${FINAL_NAME}</th><th>${h(myTeam().short)}のリーグの優勝</th><th>${h(myTeam().short)}</th></tr>${S.history.map(x => `<tr><td>${x.year}</td><td class="l">${h(x.ws || '')}</td><td class="l">${h(x.lgChamp || '')}</td><td class="l">地区${x.rank}位（${x.w}勝${x.l}敗）${x.post ? ` ${h(x.post)}` : ''}</td></tr>`).join('')}</table>` : '<p class="muted">まだありません</p>';
  return `
  <section class="card"><div class="row"><h2>順位</h2>
    <div class="seg">${LEAGUES.map(l => `<button class="${l === lg ? 'on' : ''}" data-act="lg" data-lg="${l}">${LEAGUE_NAME[l]}</button>`).join('')}</div></div>
    <div class="grid3">${DIVS.map(dv => `<div><h3>${dv}地区</h3>${standTable(standings(lg, dv), true)}</div>`).join('')}</div>
    <h3>ワイルドカード争い</h3>${wcTable(lg, false)}
    <p class="muted small">各リーグ、地区優勝の 3 球団とワイルドカードの 3 球団がポストシーズンに出ます。同じ勝率なら直接対決、それも同じなら地区の中の勝率で決めます。</p>
  </section>
  <section class="card"><h2>個人成績トップ5（${LEAGUE_NAME[lg]}）</h2>
    <p class="muted">打率は${Math.ceil(gp * 3.1)}打席以上、防御率は${gp}回以上が対象</p>
    <div class="leaders">${ls.map(c => `<div><h3>${c.name}</h3><ol>${c.list.map(p => `<li>${teamChip(S.teams[p.teamId])} ${nameCell(p)} <b>${c.fmt(p)}</b></li>`).join('') || '<li class="muted">該当なし</li>'}</ol></div>`).join('')}</div>
  </section>
  <section class="card"><h2>歴代</h2>${hist}</section>
  ${renderStandHist()}`;
}

function renderStandHist() {
  const H = S.standHist || [];
  if (!H.length) return '<section class="card"><h2>過去の順位</h2><p class="muted">シーズンが終わると、ここに最終順位が残ります。</p></section>';
  if (!H.some(x => x.year === UI.histYear)) UI.histYear = H[0].year;
  const y = H.find(x => x.year === UI.histYear);
  const hide = y.year === S.year && pbpUnseenKind('ws');
  const table = rows => `<div class="scroll"><table class="tbl"><tr><th>順</th><th>球団</th><th>勝</th><th>敗</th><th>勝率</th><th>差</th><th>得点</th><th>失点</th></tr>
    ${rows.map((r, i) => `<tr class="${r.id === S.myTeamId ? 'me' : ''}"><td>${i + 1}</td><td class="l"><span class="chip" style="background:${r.color}">${h(r.short)}</span>${y.ws === r.name && !hide ? ' <span class="tag awaken-tag">優勝</span>' : ''}</td>
      <td>${r.w}</td><td>${r.l}</td><td>${(r.w + r.l ? r.w / (r.w + r.l) : 0).toFixed(3).replace(/^0/, '')}</td><td>${i ? r.gb.toFixed(1) : '-'}</td><td>${r.rs != null ? r.rs : '-'}</td><td>${r.ra != null ? r.ra : '-'}</td></tr>`).join('')}</table></div>`;
  return `<section class="card"><div class="row"><h2>過去の順位</h2>
    <select data-chg="histYear">${H.map(x => `<option value="${x.year}" ${x.year === UI.histYear ? 'selected' : ''}>${x.year}年</option>`).join('')}</select></div>
    <p>${y.year}年（${y.games}試合）${y.ws && !hide ? ` ・ ${FINAL_NAME}優勝：<b>${h(y.ws)}</b>` : ''}</p>
    ${LEAGUES.map(lg => `<h3>${LEAGUE_NAME[lg]}${(y.slim || []).includes(lg) ? ' <span class="muted small">（整理済み）</span>' : ''}</h3><div class="grid3">${DIVS.map(dv => `<div><h4>${dv}地区</h4>${table((y.div[lg + dv] || []).map(histRow))}</div>`).join('')}</div>`).join('')}
  </section>`;
}

// ---------- 記録・歴史・殿堂 ----------
const recFmt = k => (k === 'avg' || k === 'ops' ? v => v.toFixed(3).replace(/^0/, '') : k === 'era' ? v => v.toFixed(2) : v => v);
// 記録の中の名前（いる選手は押すと詳細が開く。引退した選手は名前だけ）
const pName = (id, name) => (S.players[id] ? `<a href="#" data-act="player" data-pid="${id}">${h(name)}</a>` : h(name));

function renderRecords() {
  const v = UI.recView;
  const seg = [['hist', '年表'], ['season', 'シーズン記録'], ['career', '通算記録'], ['hof', '殿堂入り'], ['team', '球団の記録'], ['as', 'オールスター'], ['feat', '達成記録']];
  const body = v === 'season' ? recSeason() : v === 'career' ? recCareer() : v === 'hof' ? recHof() : v === 'team' ? recTeam() : v === 'as' ? recAllStar() : v === 'feat' ? recFeat() : recHist();
  return `<section class="card"><h2>記録・歴史・殿堂</h2>
    <div class="seg">${seg.map(([k, n]) => `<button class="${v === k ? 'on' : ''}" data-act="recView" data-k="${k}">${n}</button>`).join('')}</div>
    ${body}</section>`;
}

// 年表：優勝・MVP と、その年のタイトル
function recHist() {
  const H = S.standHist || [];
  if (!H.length) return '<p class="muted">シーズンが終わると、ここに年ごとの優勝やタイトルが残ります。</p>';
  const aw = y => (S.awardHist.find(x => x.year === y) || { list: [] }).list;
  const mvp = (y, lg) => { const a = aw(y).find(x => x.title === 'MVP' && x.lg === lg); return a ? `${pName(a.pid, a.name)}<span class="muted">（${h(a.team)}）</span>` : '-'; };
  const mine = y => S.history.find(x => x.year === y);
  const rows = H.map(y => {
    const m = mine(y.year), hide = y.year === S.year && pbpUnseenKind('ws');
    return `<tr><td>${y.year}</td><td class="l">${hide ? '？' : y.ws ? `🏆 ${h(y.ws)}` : '-'}</td>
      ${LEAGUES.map(lg => `<td class="l">${mvp(y.year, lg)}</td>`).join('')}<td class="l">${m ? `地区${m.rank}位${m.post && !hide ? ` ${h(m.post)}` : ''}` : '-'}</td></tr>`;
  }).join('');
  if (!H.some(x => x.year === UI.recYear)) UI.recYear = H[0].year;
  const list = aw(UI.recYear);
  const detail = list.length ? `<div class="grid2">${LEAGUES.map(lg => `<div><h3>${LEAGUE_NAME[lg]}</h3><table class="tbl">${list.filter(a => a.lg === lg)
    .map(a => `<tr><td class="l">${h(a.title)}</td><td class="l">${pName(a.pid, a.name)}<span class="muted">（${h(a.team)}）</span></td><td>${h(String(a.val))}</td></tr>`).join('')}</table></div>`).join('')}</div>`
    : '<p class="muted">この年のタイトルの記録はありません。</p>';
  const yr = S.awardHist.find(x => x.year === UI.recYear) || {};
  return `<div class="scroll"><table class="tbl"><tr><th>年</th><th>${FINAL_NAME}</th>${LEAGUES.map(lg => `<th>${LEAGUE_SHORT[lg]}MVP</th>`).join('')}<th>${h(myTeam().short)}</th></tr>${rows}</table></div>
    <div class="row"><h3>タイトル</h3><select data-chg="recYear">${H.map(x => `<option value="${x.year}" ${x.year === UI.recYear ? 'selected' : ''}>${x.year}年</option>`).join('')}</select></div>
    ${detail}
    ${posAwards('ベストナイン', yr.b9)}${posAwards('名手賞（守備）', yr.gg)}
    ${slimPanel(H)}`;
}

// ベストナイン・名手賞の表（両リーグを並べる）
function posAwards(title, list) {
  if (!list || !list.length) return '';
  return `<h3>${title}</h3><div class="grid2">${LEAGUES.map(lg => `<div><h4>${LEAGUE_NAME[lg]}</h4><table class="tbl">${list.filter(a => a.lg === lg)
    .map(a => `<tr class="${S.players[a.pid] && S.players[a.pid].teamId === S.myTeamId ? 'me' : ''}"><th>${a.pos === '指' ? 'DH' : a.pos}</th><td class="l">${pName(a.pid, a.name)}<span class="muted">（${h(a.team)}）</span></td><td>${h(a.val)}</td></tr>`).join('')}</table></div>`).join('')}</div>`;
}

// 古い年の記録の整理
function slimPanel(H) {
  if (H.length < 2) return '';
  const years = H.map(x => x.year);
  if (!years.includes(UI.slimUntil)) UI.slimUntil = years[Math.min(years.length - 1, 10)] || years[years.length - 1];
  const myLg = myTeam().lg, other = LEAGUES.find(l => l !== myLg);
  const lgs = UI.slimScope === 'both' ? LEAGUES : [other];
  const save = slimSaving(UI.slimUntil, lgs);
  const from = years[years.length - 1];
  return `<details class="slim"><summary>🧹 古い年の記録を整理する（セーブを軽くする）</summary>
    <p>選んだ年までの<b>順位表の得点・失点</b>と、<b>MVP を含むタイトル・ベストナイン・名手賞の一覧</b>を消します。年表の MVP の列は「-」になります。</p>
    <p class="muted small">残るもの：優勝・各球団の順位と勝敗・球団の記録・シーズン記録・通算記録・殿堂入り。
      まだいる選手が取ったタイトルは、選手の詳細と殿堂入りの点には残ります。</p>
    <p><select data-chg="slimUntil">${years.map(y => `<option value="${y}" ${y === UI.slimUntil ? 'selected' : ''}>${from}〜${y}年</option>`).join('')}</select>
      <select data-chg="slimScope"><option value="other" ${UI.slimScope !== 'both' ? 'selected' : ''}>${LEAGUE_NAME[other]}（自分のいないリーグ）だけ</option><option value="both" ${UI.slimScope === 'both' ? 'selected' : ''}>両リーグ</option></select></p>
    <p>${save > 0 ? `だいたい <b>${save.toLocaleString()}文字</b> 軽くなります（いまのセーブは約${JSON.stringify(S).length.toLocaleString()}文字）。` : 'この範囲は、もう整理してあります。'}</p>
    <p><button class="danger" data-act="slimNow" ${save > 0 ? '' : 'disabled'}>整理する（元に戻せません）</button></p></details>`;
}

function teamTag(r) { return r ? `<span class="chip" style="background:${r.color}">${h(r.short)}</span> <span class="muted">${r.w}勝</span>` : '-'; }

function recSeason() {
  const R = S.records.season;
  if (!SEASON_REC.some(r => (R[r.k] || []).length)) return '<p class="muted">シーズンが終わると、歴代のシーズン記録（トップ10）がここに残ります。</p>';
  return `<p class="muted">歴代のトップ${REC_TOP}です。打率・OPS・防御率は規定に届いた選手だけ。今季の記録は、レギュラーシーズンが終わったときに入ります。</p>
    <div class="leaders">${SEASON_REC.map(r => `<div><h3>${r.name}</h3><ol>${(R[r.k] || []).map(x => `<li class="${S.players[x.pid] && S.players[x.pid].teamId === S.myTeamId ? 'me' : ''}">${pName(x.pid, x.name)} <b>${recFmt(r.k)(x.v)}</b> <span class="muted">${h(x.team)}・${x.year}${x.games !== 162 ? `（${x.games}試合）` : ''}</span></li>`).join('') || '<li class="muted">まだなし</li>'}</ol></div>`).join('')}</div>`;
}

function careerPool() {
  const act = Object.values(S.players).filter(p => p.teamId != null || S.freeAgents.includes(p.id))
    .map(p => ({ id: p.id, name: p.name, c: careerTotal(p), active: true, team: p.teamId != null ? S.teams[p.teamId].short : '自由契約', bat: canBat(p), isP: canPitch(p) }));
  const ret = S.retired.map(r => ({ id: r.id, name: r.name, c: r.c, active: false, team: r.teams.join('→'), bat: r.bat, isP: r.isP, hof: r.hof }));
  return act.concat(ret);
}

function recCareer() {
  const pool = careerPool();
  const top = k => pool.filter(x => x.c[k] > 0).sort((a, b) => b.c[k] - a.c[k]).slice(0, REC_TOP);
  // 節目の記録に近づいている現役選手
  const near = [];
  pool.filter(x => x.active).forEach(x => MILESTONES.forEach(m => {
    const need = byGames(m.n), have = x.c[m.k];
    if (have < need && have >= need * 0.75) near.push({ x, m, need, have });
  }));
  near.sort((a, b) => (b.have / b.need) - (a.have / a.need));
  return `<p class="muted">現役と、記録を残して引退した選手の通算です。<span class="tag">現役</span>が付いている選手は、まだ記録を伸ばせます。</p>
    <div class="leaders">${CAREER_REC.map(([k, n]) => `<div><h3>${n}</h3><ol>${top(k).map(x => `<li>${x.active ? pName(x.id, x.name) : h(x.name)} <b>${x.c[k]}</b> <span class="muted">${h(x.team)}</span>${x.active ? '<span class="tag">現役</span>' : ''}${x.hof ? '<span class="tag awaken-tag">殿堂</span>' : ''}</li>`).join('') || '<li class="muted">まだなし</li>'}</ol></div>`).join('')}</div>
    <h3>節目の記録が近い現役選手</h3>
    ${near.length ? `<ul class="news">${near.slice(0, 12).map(n => `<li>${pName(n.x.id, n.x.name)} <span class="muted">${h(n.x.team)}</span>：${n.m.label}まで あと<b>${n.need - n.have}</b>（いま${n.have}）</li>`).join('')}</ul>` : '<p class="muted">いまはいません。</p>'}
    <p class="muted small">節目：${MILESTONES.map(m => `${m.label.replace(/\d+/, byGames(m.n))}`).join('・')}${S.games !== 162 ? `（${S.games}試合のシーズンに合わせています）` : ''}</p>`;
}

function careerLine(r) {
  const c = r.c, out = [];
  if (r.bat && c.pa) out.push(`${c.g}試合 打率${U.avg(c.h, c.ab)} ${c.h}安打 ${c.hr}本 ${c.rbi}打点 ${c.sb}盗塁`);
  if (r.isP && c.pg) out.push(`${c.pg}登板 ${c.w}勝${c.l}敗${c.sv ? ` ${c.sv}S` : ''} 防御率${U.era(c.per, c.outs)} ${c.pk}奪三振`);
  return out.join(' ／ ');
}

function recHof() {
  const hof = S.retired.filter(r => r.hof), others = S.retired.filter(r => !r.hof);
  const card = r => `<div class="hof-card ${r.hof ? 'hof' : ''} ${r.my ? 'mine' : ''}"><div class="hof-name"><button class="star-btn ${r.star ? 'on' : ''} ${r.hof ? 'hof-star' : ''}" data-act="retStar" data-id="${r.id}" title="${r.hof ? '殿堂入りの星（外すと、古い順に消えることがあります）' : '星を付けると消えません'}">${r.star ? '★' : '☆'}</button>${r.hof ? '🏛️ ' : ''}<b>${h(r.name)}</b> <span class="muted">${h(r.pos)}・${r.from}〜${r.to}年・${h(r.teams.join('→'))}</span>${r.my ? '<span class="tag">わがチームのOB</span>' : ''}${r.draft ? ` <span class="muted small">${h(r.draft)}</span>` : ''}</div>
    <div>${careerLine(r)}</div>
    ${r.ms.length ? `<div class="atitle">${r.ms.map(h).join('・')}</div>` : ''}
    ${r.titles.length ? `<div class="muted small">🏆 ${r.titles.map(h).join('、')}</div>` : ''}</div>`;
  return `<p class="muted">引退した選手のうち、${MILESTONES.map(m => m.label.replace(/\d+/, byGames(m.n))).join('・')}のどれかに届いた選手と、タイトルや長い活躍で大きな記録を残した選手が殿堂入りします。</p>
    <p class="muted small">殿堂入りの選手には、はじめから<span class="hof-star-sample">★</span>が付いていて、ずっと残ります。★を外すと、ほかの選手と同じように古い順に消えることがあります。</p>
    <h3>殿堂入り（${hof.length}人${hof.some(r => !r.star) ? `・★を外した${hof.filter(r => !r.star).length}人` : ''}）</h3>${hof.length ? hof.map(card).join('') : '<p class="muted">まだいません。名選手が引退すると、ここに入ります。</p>'}
    <h3>記録を残して引退した選手（${others.length}人・★${others.filter(r => r.star).length}人）</h3>
    <p class="muted small">☆を押して★にした選手は、ずっと残ります。★のない選手は（★を外した殿堂入りの選手もふくめて）、新しい${RETIRED_KEEP}人と、通算記録のトップ${REC_TOP}に入っている選手だけが残り、それより古い選手は引退する選手が出るたびに消えていきます。</p>
    ${others.length ? others.map(card).join('') : '<p class="muted">まだいません。</p>'}`;
}

// 球団ごとの優勝回数・最多勝利のシーズン
// ---------- 試合を順を追って見る（ユニバースシリーズ。その年の分だけ） ----------
const PBP_WORD = { BB: '四球', K: '三振', HR: 'ホームラン', '1B': 'ヒット', '2B': 'ツーベースヒット', '3B': 'スリーベースヒット', GO: '内野ゴロ', FO: '外野フライ', DP: '併殺打', SF: '犠牲フライ' };
// 結果が分からないように、ボタンには点を出さない
function pbpButtons(kind) {
  let list = (S.pbp || []).map((g, i) => [g, i]).filter(([g]) => g.kind === kind);
  // 何戦まであったかも結果のうちなので、まだ見ていない試合は次の 1 試合だけ出す
  const first = list.findIndex(([g]) => !g.seen);
  if (first >= 0) list = list.slice(0, first + 1);
  if (!list.length) return '';
  const name = k => `第${k + 1}戦`;
  return `<p class="pbp-btns">${list.map(([g, i], k) => (g.seen ? `<button data-act="pbp" data-i="${i}">${name(k)}をもう一度</button>`
    : `<button class="primary" data-act="pbp" data-i="${i}">▶ ${name(k)}を見る</button>`)).join(' ')}</p>`;
}
function pbpHalf(e) { return typeof e[0] === 'number' ? [e[0], e[1]] : [e[1], e[2]]; }
// いまの場面（回・アウト・塁・点）を、見せたところまでの記録から作る
function pbpState(ev) {
  let st = { inn: 1, half: 0, outs: 0, bases: 0, sc: [0, 0] };
  ev.forEach(e => {
    const [inn, half] = pbpHalf(e);
    if (inn !== st.inn || half !== st.half) st = { ...st, inn, half, outs: 0, bases: 0 };
    if (e[0] === 'S') { st.outs = e[5]; st.bases = e[4] ? (st.bases & ~1) | 2 : st.bases & ~1; }
    else if (typeof e[0] === 'number') { st.outs = e[5]; st.bases = e[6]; st.sc = [e[7], e[8]]; }
    if (st.outs >= 3) st.bases = 0;
  });
  return st;
}
// 見たところまでの、打者・投手の今日の成績（打順は試合中に変わらない）
const PBP_HIT = { '1B': 1, '2B': 1, '3B': 1, HR: 1 };
function pbpBox(G, shown) {
  const newPit = name => ({ name, outs: 0, bf: 0, h: 0, hr: 0, r: 0, bb: 0, k: 0 });
  const bat = [0, 1].map(s => G.order[s].map(([name, pos]) => ({ name, pos, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, sb: 0 })));
  const pit = [[newPit(G.sp[0])], [newPit(G.sp[1])]];
  const pa = [0, 0];
  let key = null, lastOuts = 0;
  shown.forEach(e => {
    const [inn, half] = pbpHalf(e), k = `${inn}-${half}`;
    if (k !== key) { key = k; lastOuts = 0; }
    if (e[0] === 'P') { pit[1 - e[2]].push(newPit(e[4])); return; }
    const cur = pit[1 - half][pit[1 - half].length - 1];
    if (e[0] === 'S') {
      const r = bat[half].find(x => x.name === e[3]);
      if (r && e[4]) r.sb++;
      cur.outs += e[5] - lastOuts; lastOuts = e[5];
      return;
    }
    const r = bat[half][pa[half] % 9];
    pa[half]++;
    const code = e[3];
    if (code !== 'BB' && code !== 'SF') r.ab++;
    if (PBP_HIT[code]) { r.h++; cur.h++; }
    if (code === 'HR') { r.hr++; cur.hr++; }
    if (code === 'BB') { r.bb++; cur.bb++; }
    if (code === 'K') { r.k++; cur.k++; }
    if (code !== 'DP') r.rbi += e[4];
    cur.r += e[4]; cur.bf++;
    cur.outs += e[5] - lastOuts; lastOuts = e[5];
  });
  return { bat, pit, pa };
}

// 野球速報のアプリのように：スコア・いまの場面（塁・アウト・投手と打者）・直前のプレー、下に経過と成績のタブ
// 速報：5 回を過ぎてもヒットも点も出ていなければ「ノーヒットノーラン継続中」。終わって勝っていれば達成
function pbpNoNo(box, hits, sc, done, team, G) {
  return [0, 1].map(s => {
    const b = 1 - s, pit = box.pit[s], outs = U.sum(pit, r => r.outs);
    if (hits[b] || sc[b] || outs < 15) return '';
    const word = pit.length > 1 ? '継投ノーヒットノーラン' : U.sum(box.bat[b], r => r.bb) ? 'ノーヒットノーラン' : '完全試合';
    if (done) return G.score[s] > G.score[b] ? `<div class="pbp-nono">🎉 ${h(team(s))} ${word}達成！</div>` : '';
    return `<div class="pbp-nono">${h(team(s))}${pit.length > 1 ? '' : `・${h(pit[0].name)}`} ${word}継続中（${U.ip(outs)}回）</div>`;
  }).join('');
}
function renderPbp() {
  const v = UI.pbpView, G = (S.pbp || [])[v.i];
  if (!G) return '<p>この試合の記録はもうありません（次のシーズンが始まると消えます）。</p>';
  const ev = G.ev, shown = ev.slice(0, v.step), done = v.step >= ev.length;
  const st = pbpState(shown);
  const team = half => (half ? G.home : G.away);
  const box = pbpBox(G, shown);
  const sc = done ? G.score : st.sc;
  const hits = [0, 1].map(s => U.sum(box.bat[s], r => r.h));
  // スコアボード（見たところまで）
  const n = Math.max(9, G.line[0].length);
  const runs = [[], []];
  shown.forEach(e => { if (typeof e[0] === 'number') runs[e[1]][e[0] - 1] = (runs[e[1]][e[0] - 1] || 0) + e[4]; });
  const reached = (half, i) => shown.length && (i + 1 < st.inn || (i + 1 === st.inn && half <= st.half));
  const cell = (half, i) => (done ? (G.line[half][i] != null ? G.line[half][i] : '') : reached(half, i) ? runs[half][i] || 0 : '');
  const nowCol = !done && shown.length ? st.inn - 1 : -1;
  const board = `<div class="scroll"><table class="line pbp-line"><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('')}<th>計</th><th>安</th></tr>
    ${[0, 1].map(half => `<tr><th>${h(team(half))}</th>${Array.from({ length: n }, (_, i) => `<td class="${i === nowCol && half === st.half ? 'pbp-now-cell' : ''}">${cell(half, i)}</td>`).join('')}<td class="r">${sc[half]}</td><td>${hits[half]}</td></tr>`).join('')}</table></div>`;
  // 次に打つ側（3 アウトなら攻守交代のあと）
  const nextHalf = !shown.length ? 0 : st.outs >= 3 ? 1 - st.half : st.half;
  const batter = box.bat[nextHalf][box.pa[nextHalf] % 9];
  const pitcher = box.pit[1 - nextHalf][box.pit[1 - nextHalf].length - 1];
  const nextInn = !shown.length ? 1 : st.outs >= 3 && st.half ? st.inn + 1 : st.inn;
  const inningLabel = done ? '試合終了' : !shown.length ? 'プレイボール前' : st.outs >= 3 ? `${st.inn}回${st.half ? '裏' : '表'} 終了` : `${st.inn}回${st.half ? '裏' : '表'}`;
  const base = k => `<span class="base b${k} ${st.bases & k ? 'on' : ''}"></span>`;
  const outsShown = st.outs >= 3 ? 0 : st.outs;
  // 直前のプレー
  const last = shown[shown.length - 1];
  let now = '';
  if (last && last[0] === 'P') now = `<div class="pbp-now">${h(last[3])} 投手交代　<b>${h(last[4])}</b></div>`;
  else if (last && last[0] === 'S') now = `<div class="pbp-now">${h(last[3])}　<b>盗塁${last[4] ? '成功' : '失敗'}</b></div>`;
  else if (last) now = `<div class="pbp-now ${last[3] === 'HR' ? 'hr' : last[4] ? 'run' : ''}"><span class="muted">${last[0]}回${last[1] ? '裏' : '表'}</span> ${h(last[2])}　<b>${PBP_WORD[last[3]] || last[3]}</b>${last[4] ? `　<b class="pbp-pts">${last[4]}点</b>` : ''}</div>`;
  const live = `<div class="pbp-live">
    <div class="pbp-score"><span class="pbp-team">${h(G.away)}</span><b>${sc[0]}</b><span class="pbp-inning">${inningLabel}</span><b>${sc[1]}</b><span class="pbp-team">${h(G.home)}</span></div>
    ${done ? `<div class="pbp-final">${G.tb ? `<p>同点のため、タイブレークで <b>${h(G.tb)}</b> の勝ち</p>` : ''}<p>勝：${h(G.wp || '-')}　負：${h(G.lp || '-')}${G.sv ? `　S：${h(G.sv)}` : ''}</p></div>`
      : `<div class="pbp-mid">
      <div class="pbp-field">${base(2)}${base(4)}${base(1)}</div>
      <div class="pbp-out">O ${[0, 1].map(i => `<span class="dot ${i < outsShown ? 'on' : ''}"></span>`).join('')}</div>
      <div class="pbp-match">
        <div><span class="muted">${nextInn}回${nextHalf ? '裏' : '表'}・投手</span> <b>${h(pitcher.name)}</b> <small class="muted">${U.ip(pitcher.outs)}回 ${pitcher.k}奪三振 ${pitcher.r}失点</small></div>
        <div><span class="muted">${h(team(nextHalf))}・${box.pa[nextHalf] % 9 + 1}番</span> <b>${h(batter.name)}</b> <small class="muted">${batter.ab}打数${batter.h}安打${batter.hr ? ` ${batter.hr}本` : ''}${batter.rbi ? ` ${batter.rbi}打点` : ''}</small></div>
      </div></div>`}
    ${pbpNoNo(box, hits, sc, done, team, G)}${now}</div>`;
  const btn = (to, label, dis, cls) => `<button class="${cls || ''}" data-act="pbpGo" data-to="${to}" ${dis ? 'disabled' : ''}>${label}</button>`;
  const ctrl = `<p class="pbp-btns">${btn('pa', '次の打席 ▶', done, 'primary')} ${btn('inn', '次の回 ▶▶', done)} ${btn('end', '結果まで ⏭', done)} ${btn('start', '最初から', !v.step)}</p>`;
  // 下のタブ：経過・打撃成績・投手成績・スタメン
  const tab = v.tab || 'log';
  const tabs = [['log', '経過'], ['bat', '打撃成績'], ['pit', '投手成績'], ['order', 'スタメン']];
  const tabBar = `<div class="seg">${tabs.map(([k, nm]) => `<button class="${tab === k ? 'on' : ''}" data-act="pbpTab" data-k="${k}">${nm}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'log') {
    const groups = [];
    shown.forEach(e => {
      const [inn, half] = pbpHalf(e), key = `${inn}-${half}`;
      if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, head: `<li class="pbp-inn">${inn}回${half ? '裏' : '表'}（${h(team(half))}）</li>`, items: [] });
      const items = groups[groups.length - 1].items;
      if (e[0] === 'P') items.push(`<li class="muted">${h(e[3])} 投手交代 → ${h(e[4])}</li>`);
      else if (e[0] === 'S') items.push(`<li>${h(e[3])} 盗塁${e[4] ? '成功' : '失敗'}</li>`);
      else items.push(`<li class="${e[4] ? 'pbp-run' : ''}">${h(e[2])}　${PBP_WORD[e[3]] || e[3]}${e[4] ? `　<b>${e[4]}点</b>（${e[7]}-${e[8]}）` : ''}</li>`);
    });
    body = groups.length ? `<ol class="pbp-log">${groups.reverse().map(g => g.head + g.items.reverse().join('')).join('')}</ol>` : `<p class="muted">プレイボール前です。「次の打席 ▶」で始まります。</p>`;
  } else if (tab === 'bat') {
    body = `<div class="grid2">${[0, 1].map(s => `<div><h4>${h(team(s))}</h4><div class="scroll"><table class="tbl"><tr><th></th><th>守</th><th>選手</th><th>打数</th><th>安</th><th>本</th><th>点</th><th>四</th><th>三振</th></tr>
      ${box.bat[s].map((r, i) => `<tr><td>${i + 1}</td><td>${r.pos === '指' ? 'DH' : h(r.pos)}</td><td class="l">${h(r.name)}</td><td>${r.ab}</td><td>${r.h}</td><td>${r.hr}</td><td>${r.rbi}</td><td>${r.bb}</td><td>${r.k}</td></tr>`).join('')}</table></div></div>`).join('')}</div>`;
  } else if (tab === 'pit') {
    body = `<div class="grid2">${[0, 1].map(s => `<div><h4>${h(team(s))}</h4><div class="scroll"><table class="tbl"><tr><th>投手</th><th>回</th><th>打者</th><th>安</th><th>本</th><th>四</th><th>三振</th><th>失</th></tr>
      ${box.pit[s].map(r => `<tr><td class="l">${h(r.name)}</td><td>${U.ip(r.outs)}</td><td>${r.bf}</td><td>${r.h}</td><td>${r.hr}</td><td>${r.bb}</td><td>${r.k}</td><td>${r.r}</td></tr>`).join('')}</table></div></div>`).join('')}</div>`;
  } else {
    body = `<div class="grid2">${[0, 1].map(s => `<div><h4>${h(team(s))}（${s ? '後攻' : '先攻'}）</h4><table class="tbl">
      ${G.order[s].map(([nm, pos], i) => `<tr><td>${i + 1}</td><td>${pos === '指' ? 'DH' : h(pos)}</td><td class="l">${h(nm)}</td></tr>`).join('')}
      <tr><td></td><td>投</td><td class="l"><b>${h(G.sp[s])}</b>（先発）</td></tr></table></div>`).join('')}</div>`;
  }
  return `<h2 class="pbp-title">${h(G.label)}</h2>${board}${live}${ctrl}${tabBar}${body}`;
}
function pbpGo(to) {
  const v = UI.pbpView, G = S.pbp[v.i], ev = G.ev;
  pbpMove(v, ev, to);
  if (v.step >= ev.length) G.seen = true;
}
function pbpMove(v, ev, to) {
  if (to === 'start') v.step = 0;
  else if (to === 'end') v.step = ev.length;
  else if (to === 'pa') {
    // 投手交代や盗塁は、次の打席と一緒に見せる
    while (v.step < ev.length && typeof ev[v.step][0] !== 'number') v.step++;
    v.step = Math.min(ev.length, v.step + 1);
  } else if (v.step < ev.length) {
    // いまの回（表・裏）の終わりまで
    const key = i => pbpHalf(ev[i]).join();
    const k0 = key(v.step);
    while (v.step < ev.length && key(v.step) === k0) v.step++;
  }
}



// 国際大会：歴代の結果
// 達成記録（ユニバースシリーズでまだ見ていない試合の分は出さない）
function featsVisible() { return (S.feats || []).filter(f => !(f.y === S.year && f.pbi != null && pbpUnseen(f.pbi))); }
function recFeat() {
  const list = featsVisible();
  const count = k => list.filter(f => f.k === k).length;
  const kinds = ['pg', 'nh', 'rnh', 'cyc', 'hr4', 'k'];
  return `<p class="muted">ノーヒットノーラン・完全試合・継投ノーヒットノーラン・サイクル安打・1 試合 4 本塁打・1 試合 ${FEAT_K} 奪三振以上が出ると、ここに残ります。</p>
    <p>${kinds.map(k => `${k === 'k' ? `${FEAT_K}奪三振以上` : FEAT_WORD[k]} <b>${count(k)}</b>${count(k) ? ` <button class="sm" data-act="featDelKind" data-k="${k}">まとめて消す</button>` : ''}`).join('　')}</p>
    <p class="muted small">消した記録は元に戻せません。選手の画面の札（完全試合×1 など）は残ります。</p>
    ${list.length ? `<div class="scroll"><table class="tbl"><tr><th>年</th><th>日</th><th>記録</th><th>選手</th><th>球団</th><th>相手</th><th></th></tr>
      ${list.map(f => `<tr class="${f.team === myTeam().short ? 'me' : ''}"><td>${f.y}</td><td class="nowrap">${h(f.label || '')}</td><td class="l"><b>${h(featText(f))}</b></td>
        <td class="l">${f.pids.length === 1 ? pName(f.pids[0], f.name) : h(f.name)}</td><td>${h(f.team)}</td><td>${h(f.opp)}</td><td><button class="sm" data-act="featDel" data-i="${S.feats.indexOf(f)}">消す</button></td></tr>`).join('')}</table></div>`
      : '<p class="muted">まだありません。</p>'}`;
}


// オールスター：今年の出場選手と、歴代の結果・MVP（守る位置の順に並べる）
const AS_POS_ORDER = ['捕', '一', '二', '三', '遊', '外', '指', '先', '中', '抑'];
function recAllStar() {
  const A = S.allStar, H = S.asHist || [];
  if (!A && !H.length) return '<p class="muted">7 月にオールスターがあります。ファン投票（人気度）と監督推薦（成績）で選ばれます。</p>';
  const roster = A ? `<h3>${A.year}年の出場選手</h3>
    <p class="muted small">⭐ はファン投票で選ばれた選手。ほかは監督推薦です。</p>
    <div class="grid2">${LEAGUES.map(lg => `<div><h4>全${LEAGUE_SHORT[lg]}</h4><table class="tbl">${A.sel[lg].slice().sort((a, b) => AS_POS_ORDER.indexOf(a.pos) - AS_POS_ORDER.indexOf(b.pos) || b.fan - a.fan).map(x => `<tr class="${S.players[x.pid] && S.players[x.pid].teamId === S.myTeamId ? 'me' : ''}"><th>${x.pos === '指' ? 'DH' : h(x.pos)}</th>
      <td class="l">${x.fan ? '⭐ ' : ''}${pName(x.pid, x.name)}<span class="muted">（${h(x.team)}）</span></td></tr>`).join('')}</table></div>`).join('')}</div>` : '';
  const res = g => `全${LEAGUE_SHORT[g[0] === 'ナ' ? 'エ' : 'ナ']} ${g[1]} - ${g[2]} 全${LEAGUE_SHORT[g[0]]}`;
  const hist = H.length ? `<h3>歴代の結果</h3><div class="scroll"><table class="tbl"><tr><th>年</th><th>結果</th><th>MVP</th></tr>
    ${H.map(y => `<tr><td>${y.y}</td><td>${y.g[0] ? res(y.g[0]) : '-'}</td><td class="l">${y.mvp ? `${h(y.mvp[0])}<span class="muted">（${h(y.mvp[1])}）</span>` : '-'}</td></tr>`).join('')}</table></div>` : '';
  return roster + hist;
}

function recTeam() {
  const H = S.standHist || [];
  if (!H.length) return '<p class="muted">シーズンが終わると、球団ごとの記録がここに残ります。</p>';
  const rows = S.teams.map(t => {
    const seasons = H.map(y => { const d = (y.div || {})[t.lg + t.div] || []; const i = d.findIndex(r => r.id === t.id); return i < 0 ? null : { ...histRow(d[i]), rank: i + 1, year: y.year, games: y.games, ws: y.ws === t.name }; }).filter(Boolean);
    const best = seasons.slice().sort((a, b) => b.w / Math.max(1, b.w + b.l) - a.w / Math.max(1, a.w + a.l))[0];
    return { t, divWin: seasons.filter(s => s.rank === 1).length, ws: seasons.filter(s => s.ws).length, best, last: seasons.filter(s => s.rank === 5).length };
  }).sort((a, b) => b.ws - a.ws || b.divWin - a.divWin);
  const allSeasons = [];
  H.forEach(y => Object.values(y.div || {}).forEach(d => d.forEach((r, i) => allSeasons.push({ ...histRow(r), year: y.year, rank: i + 1, games: y.games }))));
  const pctOf = r => r.w / Math.max(1, r.w + r.l);
  const bestAll = allSeasons.slice().sort((a, b) => pctOf(b) - pctOf(a)).slice(0, 5);
  const worstAll = allSeasons.slice().sort((a, b) => pctOf(a) - pctOf(b)).slice(0, 5);
  const sline = r => `<li><span class="chip" style="background:${r.color}">${h(r.short)}</span> ${r.year}年 <b>${r.w}勝${r.l}敗</b>（勝率${pctOf(r).toFixed(3).replace(/^0/, '')}・地区${r.rank}位）</li>`;
  return `<div class="scroll"><table class="tbl"><tr><th>球団</th><th>${FINAL_NAME}優勝</th><th>地区優勝</th><th>地区最下位</th><th>いちばん良かった年</th></tr>
    ${rows.map(x => `<tr class="${x.t.id === S.myTeamId ? 'me' : ''}"><td class="l">${teamChip(x.t)} ${h(x.t.name)}</td><td>${x.ws}</td><td>${x.divWin}</td><td>${x.last}</td>
      <td class="l">${x.best ? `${x.best.year}年 ${x.best.w}勝${x.best.l}敗（地区${x.best.rank}位）` : '-'}</td></tr>`).join('')}</table></div>
    <div class="grid2"><div><h3>歴代の最高勝率</h3><ol class="plain">${bestAll.map(sline).join('')}</ol></div><div><h3>歴代の最低勝率</h3><ol class="plain">${worstAll.map(sline).join('')}</ol></div></div>
    ${retiredNoList()}`;
}

// 永久欠番の一覧（ある球団だけ）
function retiredNoList() {
  const ts = S.teams.filter(t => (t.retiredNos || []).length);
  return `<h3>永久欠番</h3>${ts.length ? `<table class="tbl">${ts.map(t => `<tr class="${t.id === S.myTeamId ? 'me' : ''}"><td class="l">${teamChip(t)}</td>
    <td class="l">${t.retiredNos.map(r => `<b>${r.no}</b> ${h(r.name)}<span class="muted">（${r.year}年）</span>`).join('　')}</td></tr>`).join('')}</table>`
    : '<p class="muted">まだありません。長く活躍した名選手が引退すると、背番号を永久欠番にできます。</p>'}`;
}

// ---------- 経営 ----------
function renderMoney() {
  const t = myTeam();
  const f = t.fin;
  const inc = f.gate + f.food + f.ltv + f.tv + f.goods + f.sponsor + f.other + Math.max(0, f.share) + f.luxIn;
  const exp = f.salary + f.ops + (f.upkeep || 0) + f.invest + f.lux + Math.max(0, -f.share);
  const facs = Object.keys(FACILITIES).map(k => {
    const lv = facLv(t, k);
    const cost = facilityCost(lv, k);
    return `<tr><td class="l" style="white-space:normal"><b>${FACILITIES[k].name}</b><br><span class="muted">${FACILITIES[k].desc}</span></td><td class="nowrap">${'■'.repeat(lv)}${'□'.repeat(FAC_MAX - lv)} Lv${lv}<br>
      ${lv < FAC_MAX ? `<button class="sm" data-act="upgrade" data-k="${k}" ${t.money < cost ? 'disabled' : ''}>改修 ${U.money(cost)}</button>` : '最大'}
      ${lv > 1 ? `<button class="sm" data-act="downgrade" data-k="${k}">下げる</button>` : ''}
      <br><span class="muted small">維持費 ${facilityUpkeep(lv, k) ? `年 ${U.money(facilityUpkeep(lv, k))}` : 'なし'}${lv < FAC_MAX ? `（上げると年 ${U.money(facilityUpkeep(lv + 1, k))}）` : ''}</span></td></tr>`;
  }).join('');
  const M = MARKETS[t.mk], line = luxLine(S.year), pay = payroll40(t);
  const lh = (S.luxHist || [])[0];
  return `
  <div class="grid2">
    <section class="card"><h2>今季の収支</h2>
      <table class="tbl money">
        <tr><th class="l">入場料</th><td>${U.money(f.gate)}</td></tr>
        <tr><th class="l">飲食</th><td>${U.money(f.food)}</td></tr>
        <tr><th class="l">地元の放映権</th><td>${U.money(f.ltv)}</td></tr>
        <tr><th class="l">全国の放映権</th><td>${U.money(f.tv)}</td></tr>
        <tr><th class="l">グッズ</th><td>${U.money(f.goods)}</td></tr>
        <tr><th class="l">スポンサー</th><td>${U.money(f.sponsor)}</td></tr>
        <tr><th class="l">その他（賞金など）</th><td>${U.money(f.other)}</td></tr>
        <tr><th class="l">収入の分け合い</th><td class="${f.share < 0 ? 'neg' : ''}">${U.money(f.share)}</td></tr>
        <tr><th class="l">ぜいたく税の分け前</th><td>${U.money(f.luxIn)}</td></tr>
        <tr><th class="l">年俸</th><td class="neg">${U.money(-f.salary)}</td></tr>
        <tr><th class="l">球場運営費</th><td class="neg">${U.money(-f.ops)}</td></tr>
        <tr><th class="l">施設の維持費</th><td class="neg">${U.money(-(f.upkeep || 0))}</td></tr>
        <tr><th class="l">ぜいたく税</th><td class="neg">${U.money(-f.lux)}</td></tr>
        <tr><th class="l">投資（施設・補強・契約金）</th><td class="neg">${U.money(-f.invest)}</td></tr>
        <tr><th class="l">差し引き</th><td class="${inc - exp < 0 ? 'neg' : ''}"><b>${U.money(inc - exp)}</b></td></tr>
      </table>
      <p>資金 <b>${U.money(t.money)}</b> ・ 年俸の合計 ${U.money(payroll(t))}/年（40人枠 ${U.money(pay)}）</p>
      <p class="muted small">収入の分け合いとぜいたく税は、レギュラーシーズンが終わったときに精算します。</p>
    </section>
    <section class="card"><h2>ぜいたく税</h2>
      <p>${S.year}年の線 <b>${U.money(line)}</b> ・ 40人枠の年俸の合計 <b class="${pay > line ? 'neg' : ''}">${U.money(pay)}</b>${pay > line ? `（<b class="neg">${U.money(pay - line)} 超え</b>・このままだと税 およそ ${U.money(luxTax(t, (t.luxYears || 0) + 1))}）` : `（あと ${U.money(line - pay)}）`}</p>
      <p class="muted small">線を超えた分に、続けて超えた年数で ${LUX_RATES.map(r => `${Math.round(r * 100)}%`).join('・')}（3 年目から）。さらに ${LUX_SUR.map(([a, r]) => `${U.money(a)} 超えた分に +${Math.round(r * 1000) / 10}%`).join('、')}。${U.money(LUX_PICK_OVER)} より多く超えると、翌年のドラフトの最初の指名が ${LUX_PICK_DROP} 番下がります。集めた税は、線を超えなかった球団で分けます。線は毎年 ${U.money(LUX_LINE_UP)} ずつ上がります。いま ${t.luxYears || 0} 年続けて超えています。</p>
      ${lh ? `<p class="small">${lh.year}年：${lh.payers.length ? lh.payers.map(x => `${S.teams[x.id].short} ${U.money(x.tax)}`).join('・') : '超えた球団なし'}${lh.payers.length ? `（1 球団あたりの分け前 ${U.money(lh.each)}）` : ''}</p>` : ''}
      <h2>市場と人気</h2>
      <p>市場の大きさ <b>${t.mk}</b> ・ 人気 <b>${Math.round(t.pop)}</b> / 100</p><div class="bt wide"><span style="width:${t.pop}%"></span></div>
      <p>チケット 1 人あたり およそ ${Math.round(M.ticket * 10000)}ドル ・ 球場の定員 ${capacity(t).toLocaleString()}人 ・ 地元の放映権 ホーム 1 試合 ${U.money(M.tv)}</p>
      <p>ホーム 1 試合の入場料 およそ <b>${U.money(capacity(t) * fillRate(t) * M.ticket)}</b></p>
      <p class="muted small">地元の収入（入場料・飲食・地元の放映権）の ${Math.round(SHARE_RATE * 100)}% を 30 球団で出し合い、等しく分け直します。市場の小さい球団ほど受け取りが多くなります。</p>
    </section>
  </div>
  <section class="card"><h2>宣伝</h2>
    <p class="muted">お金を払って、今季のグッズの売上の割合を上げます（いま <b>+${Math.round((goodsPromoMul(t) - 1) * 100)}%</b>）。どれも 1 シーズンに 1 回までで、重ねられます。</p>
    <table class="tbl">${Object.keys(PROMOS).map(k => {
      const pr = PROMOS[k], used = (t.promoUsed || []).includes(k);
      return `<tr><td class="l" style="white-space:normal"><b>${pr.name}</b><br><span class="muted">${pr.desc}・グッズの売上 +${Math.round(pr.goods * 100)}%</span></td>
        <td class="nowrap">${used ? '今季は済み' : `<button class="sm" data-act="promo" data-k="${k}" ${t.money < pr.cost || S.phase !== 'season' ? 'disabled' : ''}>${U.money(pr.cost)}</button>`}</td></tr>`;
    }).join('')}</table>
    ${S.phase !== 'season' ? '<p class="muted">宣伝はシーズン中にしかできません。</p>' : ''}
  </section>
  ${renderGoods(t)}
  <section class="card"><h2>施設</h2>
    <p>施設の維持費 <b>年 ${U.money(upkeepTotal(t))}</b></p>
    <p class="muted">毎年、改修に使った総額の ${Math.round(FAC_UPKEEP * 100)}% を、年俸と同じように少しずつ払います。「下げる」でレベルを下げると維持費は減りますが、改修に使ったお金は戻りません。</p>
    <table class="tbl">${facs}</table></section>`;
}

function renderGoods(t) {
  const types = Object.keys(GOODS_TYPES);
  if (!GOODS_TYPES[UI.goodsType]) UI.goodsType = types[0];
  const ty = GOODS_TYPES[UI.goodsType];
  const ps = teamPlayers(t).sort((a, b) => b.fame - a.fame);
  if (ty.player && !ps.some(p => p.id === UI.goodsPid)) UI.goodsPid = ps.length ? ps[0].id : null;
  const draft = { type: UI.goodsType, pid: ty.player ? UI.goodsPid : null, dev: 1, sold: 0 };
  const est = goodsRate(t, draft);
  const pickP = S.players[UI.goodsPid];
  const playerSel = ty.player ? `<select data-chg="goodsPid">${ps.map(p => `<option value="${p.id}" ${p.id === UI.goodsPid ? 'selected' : ''}>${h(p.name)}（人気${Math.round(p.fame)}・${visualStars(p.visual)}）</option>`).join('')}</select>` : '<span class="muted">球団のグッズ（球団の人気で売れる）</span>';
  const rows = t.goods.map(g => {
    const p = g.pid != null ? S.players[g.pid] : null;
    const state = g.dev > 0 ? `<span class="tag">開発中 あと${g.dev}試合</span>` : `販売中（${g.sold}試合）`;
    return `<tr><td class="l"><b>${h(goodsName(g))}</b>${p ? `<br><span class="muted">人気${Math.round(p.fame)} ・ ${visualStars(p.visual)}</span>` : ''}</td><td>${state}</td>
      <td>${g.dev > 0 ? '-' : Math.round(goodsFresh(g) * 100) + '%'}</td><td>${U.money(goodsRate(t, g))}</td><td>${U.money(g.season)}</td><td>${U.money(g.total)}</td>
      <td><button class="sm" data-act="stopGoods" data-id="${g.id}">販売終了</button></td></tr>`;
  }).join('');
  return `
  <section class="card"><h2>グッズ開発</h2>
    <p class="muted">選手のグッズは、その選手の <b>人気度</b>（活躍で上がり、活躍しないと下がる）と <b>ビジュアル</b>（★）で売れ行きが変わります。
      出たばかりはよく売れ、だんだん飽きられます。選手が移籍・引退すると販売終了。グッズを作ってもらった選手は球団への忠誠心が上がります。</p>
    <div class="row" style="justify-content:flex-start">
      <select data-chg="goodsType">${types.map(k => `<option value="${k}" ${k === UI.goodsType ? 'selected' : ''}>${GOODS_TYPES[k].name}（${U.money(GOODS_TYPES[k].cost)}）</option>`).join('')}</select>
      ${playerSel}
      <button class="primary" data-act="devGoods" ${t.goods.length >= GOODS_MAX || t.money < ty.cost ? 'disabled' : ''}>開発する</button>
    </div>
    <p>開発費 <b>${U.money(ty.cost)}</b> ・ 発売まで ${ty.days}試合 ・ 発売直後の見込み ホーム1試合 <b>${U.money(est)}</b>（ビジターの日は通販で${Math.round(AWAY_SALES * 100)}%）
      ${ty.player && ty.visual >= 1 ? '<span class="tag">ビジュアルが効く</span>' : ''}${ty.player && pickP && pickP.inj ? '<span class="tag bad">故障中</span>' : ''}</p>
    <h3>販売中のグッズ（${t.goods.length}/${GOODS_MAX}）</h3>
    ${rows ? `<div class="scroll"><table class="tbl"><tr><th>グッズ</th><th>状態</th><th>鮮度</th><th>ホーム1試合</th><th>今季売上</th><th>通算</th><th></th></tr>${rows}</table></div>` : '<p class="muted">まだありません。</p>'}
  </section>`;
}

// 契約更改の複数年の欄
function extendCell(r, p) {
  if (r.ext === 'yes') return `<b>${r.years}年契約を結びました</b>`;
  if (r.ext === 'no') return '<span class="muted">断られました</span>';
  if (r.locked) return '';
  const d = UI.extDraft[r.pid] || { mul: 1, years: 2 };
  const v = extendChance(p, d.mul, d.years);
  return `<select data-chg="extMul" data-pid="${r.pid}">${EXTEND_MULS.map(m => `<option value="${m}" ${d.mul === m ? 'selected' : ''}>査定×${m}（${U.money(Math.round(r.now * m / 10) * 10)}）</option>`).join('')}</select>
    <select data-chg="extYears" data-pid="${r.pid}">${U.range(2, EXTEND_YEARS_MAX).map(y => `<option value="${y}" ${d.years === y ? 'selected' : ''}>${y}年</option>`).join('')}</select>
    <button class="sm" data-act="extend" data-pid="${r.pid}">申し込む</button> <span class="muted small">見込み：${v >= 0.6 ? '高い' : v >= 0.35 ? '五分' : '低い'}</span>`;
}

// ---------- トレード ----------
// 相手から来たトレードの話
// いまチームでどこにいるか（人の言葉 2026-11-13「トレードの打診が来た時に、今スタメンかベンチか二軍かを出してほしい」）
function teamSpot(p) {
  const t = p.teamId != null ? S.teams[p.teamId] : null;
  if (!t) return '';
  if (t.active && !t.active.includes(p.id)) return p.on40 ? `40人枠・${p.lvl || '3A'}` : `マイナー契約・${p.lvl || '3A'}`;
  const parts = [];
  const i = (t.lineup || []).findIndex(s => s.pid === p.id);
  if (i >= 0) parts.push(`スタメン（${i + 1}番・${t.lineup[i].pos}）`);
  if (canPitch(p)) {
    if (t.rotation.includes(p.id)) parts.push('先発ローテ');
    else if (t.closer === p.id) parts.push('抑え');
    else if (t.setup === p.id) parts.push('セットアッパー');
    else if (i < 0) parts.push('中継ぎ');
  } else if (i < 0) parts.push('ベンチ');
  return parts.join('・');
}
function tradeOfferCard() {
  const list = tradeOffers();
  if (!list.length) return '';
  const who = p => `${nameCell(p)} ${posBadge(p)} <b>${teamSpot(p)}</b> ${p.age}歳 総合${Math.round(ovr(p))} 年俸${U.money(p.salary)}`;
  const rows = list.map((o, i) => {
    const t = S.teams[o.team], give = o.give.map(id => S.players[id]), get = o.get.map(id => S.players[id]);
    const head = o.kind === 'free' ? `${teamChip(t)} 「うちの選手を無償で譲ります。年俸はそちらでお願いします。」` : `${teamChip(t)} 「そちらの選手を譲ってもらえませんか。」`;
    const outs = give.map(p => `<li>出す：${who(p)}</li>`).join('');
    const ins = get.map(p => `<li>もらう：${who(p)}</li>`).join('') + (o.cash < 0 ? `<li>もらう：金銭 <b>${U.money(-o.cash)}</b></li>` : '');
    return `<div style="margin:10px 0"><p>${head}</p><ul>${outs}${ins}</ul>
      <p><button class="sm primary" data-act="tOffer" data-i="${i}" data-yes="1">受ける</button> <button class="sm" data-act="tOffer" data-i="${i}" data-yes="0">断る</button>
      <span class="muted small">あと ${o.w} 週で話は消えます</span></p></div>`;
  }).join('');
  return `<section class="card"><h2>📞 相手からの話</h2>${rows}</section>`;
}
function renderTrade() {
  if (!tradeOpen()) {
    return `<section class="card"><h2>トレード</h2><p>${S.phase === 'off' ? 'オフの契約の手続き（ノンテンダー）から再開します（ルール5の間はできません）。' : S.phase === 'post' ? 'ポストシーズン中はできません。' : 'トレード期限（7月末）を過ぎました。オフに再開します。'}</p></section>`;
  }
  const T = UI.trade;
  if (T.team == null || T.team === S.myTeamId) T.team = S.teams.find(t => t.id !== S.myTeamId).id;
  const other = S.teams[T.team], me = myTeam();
  const list = (team, sel, side) => teamPlayers(team).sort((a, b) => a.isP - b.isP || ovr(b) - ovr(a)).slice(0, 60).map(p => `
    <tr class="${sel.includes(p.id) ? 'sel' : ''}"><td><input type="checkbox" data-chg="tsel" data-side="${side}" data-pid="${p.id}" ${sel.includes(p.id) ? 'checked' : ''}></td>
    <td class="l">${nameCell(p)}${coreMark(p, side)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${Math.round(ovr(p))}</td><td>${tradeValue(p).toLocaleString()}</td></tr>`).join('');
  const cash = T.cash || 0;
  const vGive = U.sum(T.give.map(id => S.players[id]).filter(Boolean), tradeValue) + (cash > 0 ? cashValue(cash) : 0);
  const vGet = U.sum(T.get.map(id => S.players[id]).filter(Boolean), tradeValue) + (cash < 0 ? cashValue(cash) : 0);
  const core = tradeCore(other);
  const coreMark = (p, side) => side === 'get' && core.includes(p.id) ? ' <span class="tag">主力</span>' : '';
  const giveP = T.give.map(id => S.players[id]).filter(Boolean), getP = T.get.map(id => S.players[id]).filter(Boolean);
  const cr = cashTradeRatio(giveP, getP, cash);
  const ratio = cr != null ? cr : vGet ? vGive / vGet : (vGive ? 2 : 0);
  const freeErr = giveP.length && !getP.length && cash <= 0 ? freeTradeError(other, giveP) : null;
  const mood = !T.give.length && !T.get.length ? '選手を選んでください' : freeErr ? `😠 ${freeErr}` : ratio >= 1.08 ? (giveP.length && !getP.length && !cash ? '😊 無償で引き取ってくれそうです' : '😊 相手は乗り気です') : ratio >= 0.9 ? '🤔 もう一声…' : '😠 話になりません';
  // お金だけで取るときに要る金額
  const buyOnly = getP.length && !giveP.length;
  const buyCore = buyOnly && getP.some(p => core.includes(p.id));
  const buyNeed = buyOnly ? Math.ceil(U.sum(getP, cashPrice) * 1.08 / 100) * 100 : 0;
  // お金をもらって売るときの上限（相手の資金まで）
  const sellOnly = giveP.length && !getP.length;
  const sellMax = sellOnly ? Math.floor(Math.min(U.sum(giveP, cashPrice) / 1.08, other.money) / 100) * 100 : 0;
  const head = '<tr><th></th><th>名前</th><th>守</th><th>年</th><th>総合</th><th>価値</th></tr>';
  return `${tradeOfferCard()}
  <section class="card">
    <div class="row"><h2>トレード</h2>
      <select data-chg="tteam">${LEAGUES.flatMap(lg => DIVS.map(dv => [lg, dv])).map(([lg, dv]) => `<optgroup label="${divName(lg, dv)}">${S.teams.filter(t => t.lg === lg && t.div === dv && t.id !== S.myTeamId).map(t => `<option value="${t.id}" ${t.id === T.team ? 'selected' : ''}>${h(t.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <p>お金 <select data-chg="tcash" data-k="dir"><option value="1" ${cash >= 0 ? 'selected' : ''}>こちらが払う</option><option value="-1" ${cash < 0 ? 'selected' : ''}>こちらがもらう</option></select>
      <input type="number" data-chg="tcash" data-k="amt" min="0" step="10" value="${Math.abs(cash)}" style="width:7em"> 万ドル
      <span class="muted">（資金 ${U.money(me.money)} ・ 相手 ${U.money(other.money)}。選手とまぜるときは ${CASH_PER_VALUE}万ドルで価値 1）</span></p>
    <p class="muted">お金だけの売り買いの値段は、いまの力に見合う年俸と年齢に、若手なら才能と伸びしろのぶんを足して決まります。</p>
    <p class="muted">選手をお金だけで買うこともできます（金銭トレード）。ただし相手の主力（総合で上から${TRADE_CORE_N}人）はお金だけでは出してくれません。</p>
    <p class="muted">出す選手だけを選び、「こちらがもらう」で金額を入れると、選手をお金で売れます。お金を 0 にすると無償トレードです。どちらも、年俸が高すぎる選手や、相手のいちばん下の選手より力が劣る選手は断られます。</p>
    ${sellOnly && sellMax > 0 && !freeErr ? `<p>お金で売るなら <b>${U.money(sellMax)}</b> まで。 <button class="sm" data-act="tcashNeed" data-v="${-sellMax}">この金額にする</button></p>` : ''}
    ${buyOnly ? (buyCore ? '<p>主力が入っているので、お金だけでは取れません。</p>' : `<p>お金だけで取るなら <b>${U.money(buyNeed)}</b> から。 <button class="sm" data-act="tcashNeed" data-v="${buyNeed}">この金額にする</button></p>`) : ''}
    <p>出す価値 <b>${vGive.toLocaleString()}</b> ⇔ もらう価値 <b>${vGet.toLocaleString()}</b>　${mood}</p>
    <button class="primary" data-act="propose">この条件で申し込む</button>
    <div class="grid2">
      <div><h3>${teamChip(me)} 出す選手</h3><div class="scroll"><table class="tbl">${head}${list(me, T.give, 'give')}</table></div></div>
      <div><h3>${teamChip(other)} もらう選手</h3><div class="scroll"><table class="tbl">${head}${list(other, T.get, 'get')}</table></div></div>
    </div>
  </section>`;
}

// ---------- 自由契約 ----------
function renderFA() {
  const t = myTeam();
  const open = faOpen();
  const list = S.freeAgents.map(id => S.players[id]).filter(p => p && posMatch(p, UI.posf.fa)).sort((a, b) => a.isP - b.isP || ovr(b) - ovr(a));
  const btns = p => {
    const fee = Math.round(p.salary * 0.2), feeM = Math.round(MIN_SALARY * 0.2);
    const room = t.players.length < ROSTER_MAX;
    return `<button class="sm primary" data-act="signFA" data-pid="${p.id}" data-m="1" ${open && room && count40(t) < FORTY_MAX && t.money >= fee ? '' : 'disabled'}>メジャー契約（年俸${U.money(p.salary)}・契約金${U.money(fee)}）</button>
      <button class="sm" data-act="signFA" data-pid="${p.id}" data-m="0" ${open && room && t.money >= feeM ? '' : 'disabled'}>マイナー契約（契約金${U.money(feeM)}）</button>`;
  };
  const row = p => `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${p.type}</td><td class="stars">${potLabel(p)}</td>
      <td class="l">${abilKeys(p).map(k => `${SHORT_LABEL[k]}${k === 'velo' ? veloKmh(p.a.velo) + 'km' : `<span class="g g${U.grade(p.a[k])}">${U.grade(p.a[k])}</span>`}`).join(' ')}${trajTag(p)}</td>
      <td>${Math.round(ovr(p))}</td><td>${h(p.lastTeam || '-')}</td><td class="small">${svcText(p)}</td><td class="nowrap">${btns(p)}</td></tr>`;
  const head = '<tr><th>名前</th><th>守</th><th>年</th><th>型</th><th>才能</th><th>能力</th><th>総合</th><th>前所属</th><th>メジャー</th><th></th></tr>';
  const block = arr => (isMobile()
    ? cardList(arr, p => playerCard(p, { sub: `<span>${p.type}</span><span class="muted">才能</span><span class="stars">${potLabel(p)}</span>`,
      lines: `<div class="pc-line">前所属 ${h(p.lastTeam || '-')} ・ 希望年俸 ${U.money(p.salary)}</div>`, action: btns(p) }))
    : `<div class="scroll"><table class="tbl">${head}${arr.map(row).join('')}</table></div>`);
  return `
  <section class="card"><h2>自由契約選手</h2>
    <p>${open ? '<b>いま契約できます。</b>' : '<b>いまは契約できません。</b>'} 契約できるのは <b>シーズン中</b> と <b>オフの FA のあと</b>です。
      <b>メジャー契約</b>なら 40 人枠に入り、希望の年俸を払います。<b>マイナー契約</b>なら 40 人枠に入れずに安く取れます（あとで 40 人枠に上げられます）。</p>
    <p class="muted">ほかの球団が外した選手・ノンテンダーの選手・FA で決まらなかった選手・独立リーグの選手です。2 年続けて決まらないと引退します。</p>
    ${posCounts()}
    ${needsCard('fa')}
    ${posFilter('fa')}
    ${list.length ? `${list.some(p => !p.isP) ? `<h3>野手</h3>${block(list.filter(p => !p.isP))}` : ''}
      ${list.some(p => p.isP) ? `<h3>投手</h3>${block(list.filter(p => p.isP))}` : ''}` : '<p class="muted">該当する選手はいません。</p>'}
  </section>`;
}
// いまメジャーにいる選手。何年かたつとオフの FA 市場に戻ってくる


// ---------- オフシーズン ----------
const OFF_STEPS = [['awards', '表彰'], ['fa', 'QO・FA'], ['contract', 'ノンテンダー'], ['rule5', 'ルール5'], ['arb', '年俸調停'], ['intl', '国際アマ'], ['camp', 'スプリングトレーニング']];
function renderOff() {
  const O = S.off;
  const bar = `<div class="steps">${OFF_STEPS.map(([k, n]) => `<span class="${O.step === k ? 'on' : ''}">${n}</span>`).join('→')}</div>`;
  let body = '';
  const my = myTeam();
  if (O.step === 'awards' && pbpUnseenKind('ws')) {
    body = `<section class="card"><h2>🏆 ${FINAL_NAME}</h2>
      <p>まだ見ていない試合があります。結果は、試合を見てから出ます。</p>
      ${pbpButtons('ws')}
      <p><button data-act="pbpSkip" data-kind="ws">見ずに結果へ進む</button></p></section>`;
  } else if (O.step === 'awards') {
    body = `
    <section class="card"><h2>${S.year}年 シーズン終了</h2>
      <p class="big-text">${FINAL_NAME}優勝：${h(O.champ)}</p>
      <p>${h(my.name)}は ${divName(my.lg, my.div)} <b>${O.rank}位</b>（${my.w}勝${my.l}敗）${O.post ? ` ・ <b>${h(O.post)}</b>` : ''}${O.prize ? `　賞金 ${U.money(O.prize)}` : ''}</p>
      ${LEAGUES.map(lg => `<h3>${LEAGUE_NAME[lg]}</h3><div class="grid3">${DIVS.map(dv => `<div><h4>${dv}地区</h4>${standTable(standings(lg, dv), true)}</div>`).join('')}</div>`).join('')}
      ${pbpButtons('ws') ? `<h3>${FINAL_NAME}を振り返る</h3>${pbpButtons('ws')}` : ''}
    </section>
    <section class="card"><h2>表彰</h2><div class="grid2">${LEAGUES.map(lg => `<div><h3>${LEAGUE_NAME[lg]}</h3><table class="tbl">${O.awards.filter(a => (a.lg || lg) === lg).map(a => `<tr class="${S.players[a.pid] && S.players[a.pid].teamId === S.myTeamId ? 'me' : ''}"><th class="l">${a.title}</th><td class="l">${h(a.name)}（${h(a.team)}）</td><td>${a.val}</td></tr>`).join('')}</table></div>`).join('')}</div>
      ${posAwards('ベストナイン', O.b9)}${posAwards('名手賞（守備）', O.gg)}</section>
    ${S.draftNext ? `<section class="card"><h2>来年のドラフトの順番（ロッタリー）</h2><ol>${S.draftNext.lottery.map(x => `<li class="${x.id === S.myTeamId ? 'me' : ''}">${teamChip(S.teams[x.id])} <span class="muted">（成績の順では ${x.from} 番目）</span></li>`).join('')}</ol>
      <p class="muted small">プレーオフに出なかった球団で、上から ${LOTTERY_N} 番目までをくじで決めました。成績の悪い球団ほど当たりやすくなっています。7 番目からは成績の悪い順です。</p></section>` : ''}
    ${renderReleasePanel()}
    <section class="card"><button class="primary big" data-act="offNext">QO・FA へ ▶</button></section>`;
  } else if (O.step === 'fa') {
    body = renderFAStep();
  } else if (O.step === 'contract') {
    const c = O.contract;
    const tender = c.tender.map(id => S.players[id]).filter(p => p && p.teamId === my.id && arbEligible(p));
    body = `
    <section class="card"><h2>引退</h2>${c.retired.length ? `<ul>${c.retired.map((r, i) => `<li>${S.players[r.pid] ? nameCell(S.players[r.pid]) : h(r.name)}（${r.age}歳）${r.why}${retireStrength(r)}${retainCell(r, i, c)}</li>`).join('')}</ul>
      ${c.retired.some(r => r.can) ? '<p class="muted small">「慰留する」で引き止められます（1 人 1 回）。忠誠心が高く若い選手ほど残ってくれやすく、残ったら 1 年契約になります。ルール 5 へ進むと引退します。</p>' : ''}` : '<p>いません。</p>'}</section>
    ${(c.honor || []).length ? `<section class="card"><h2>永久欠番</h2>
      <p>長くチームを支えた名選手が引退しました。背番号を永久欠番にすると、これから先だれもその番号を付けられなくなり、球団の人気が少し上がります。</p>
      <table class="tbl">${c.honor.map((x, i) => `<tr><td class="l"><b>#${x.no}</b> <a href="#" data-act="honorView" data-i="${i}">${h(x.name)}</a></td><td>${x.years}年在籍</td><td>功績 ${x.merit}</td>
        <td>${x.done ? '<b>永久欠番にしました</b>' : `<button data-act="retireNo" data-i="${i}">永久欠番にする</button>`}</td></tr>`).join('')}</table></section>` : ''}
    <section class="card"><h2>ノンテンダーの期限（調停に入れる選手）</h2>
      <p>メジャーの年数が 3〜6 年の選手（とスーパー 2）は年俸調停に入れます。<b>契約する（テンダー）</b>と、このあとの年俸調停で年俸が決まります。<b>契約しない（ノンテンダー）</b>と、その選手は FA になります。</p>
      ${tender.length ? `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>総合</th><th>メジャー</th><th>今季</th><th>調停の相場</th><th>選手の希望</th><th></th></tr>
        ${tender.map(p => `<tr><td class="l">${nameCell(p)}${p.super2 === S.year ? '<span class="tag">スーパー2</span>' : ''}</td><td>${posBadge(p)}</td><td>${p.age}</td><td>${Math.round(ovr(p))}</td><td class="small">${svcText(p)}</td><td>${U.money(p.salary)}</td><td>${U.money(p.arbFair)}</td><td>${U.money(arbAsk(p))}</td>
          <td><select data-chg="tender" data-pid="${p.id}"><option value="1" ${c.myTender[p.id] !== false ? 'selected' : ''}>契約する</option><option value="0" ${c.myTender[p.id] === false ? 'selected' : ''}>契約しない（FA へ）</option></select></td></tr>`).join('')}</table></div>` : '<p class="muted">いません。</p>'}
    </section>
    <section class="card"><h2>来季の年俸と複数年契約</h2><p class="muted">調停前の選手は、球団が決めた年俸（最低年俸から少し上がるだけ）になりました。選手は 1 つ歳を取りました。「複数年」から長い契約を申し込めます（1 人 1 回）。調停前・調停の選手は、そのぶん安く長く結べます。契約のあいだは年俸が変わりません。</p>
      <div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年齢</th><th>総合</th><th>段階</th><th>今季</th><th>来季</th><th>複数年</th></tr>
      ${c.raises.filter(r => S.players[r.pid] && S.players[r.pid].teamId === S.myTeamId).map(r => { const p = S.players[r.pid]; return `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td>${Math.round(ovr(p))}</td><td class="small">${h(r.kind)}</td><td>${U.money(r.old)}</td><td>${r.kind === '調停' && !r.ext ? '<span class="muted">調停で決まる</span>' : U.money(r.now)}</td><td class="l nowrap">${extendCell(r, p)}</td></tr>`; }).join('')}
      </table></div>
      <p>来季の 40 人枠の年俸の合計（調停の選手は今季の額で） <b>${U.money(payroll40(my))}</b></p></section>
    ${renderReleasePanel()}
    <section class="card"><button class="primary big" data-act="offNext">ノンテンダーを締めてルール5ドラフトへ ▶</button></section>`;
  } else if (O.step === 'rule5') {
    const R = O.r5, mine = R.order[R.idx] === my.id && !R.myDone;
    const pool = r5Pool(my.id).sort((a, b) => ovr(b) - ovr(a)).slice(0, 60);
    const myRisk = minorsOf(my).filter(r5Eligible).sort((a, b) => tradeValue(b) - tradeValue(a));
    body = `<section class="card"><h2>ルール5ドラフト（12月）</h2>
      <p>40 人枠に入っていない選手のうち、18 歳以下で入って ${R5_YOUNG} 回目・19 歳以上で入って ${R5_OLD} 回目のルール 5 を迎えた選手は、ほかの球団に取られることがあります。取った球団は ${U.money(R5_COST)} を払い、その選手を<b>まる 1 シーズン 26 人枠</b>に置かないといけません。置けなければ元の球団に返します。</p>
      <p>指名の順番は、今季の成績の悪い順です。${mine ? '<b>あなたの番です。</b>' : R.myDone ? 'あなたの番は終わりました。' : ''}</p>
      ${mine ? `<p><button data-act="r5Pass">指名しない</button> <span class="muted">40人枠 ${count40(my)}/${FORTY_MAX}・資金 ${U.money(my.money)}</span></p>
        <div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>才能</th><th>総合</th><th>いまの球団</th><th>階層</th><th></th></tr>
        ${pool.map(p => `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td>${p.age}</td><td class="stars">${potLabel(p)}</td><td>${Math.round(ovr(p))}</td><td>${teamChip(S.teams[p.teamId])}</td><td>${p.lvl || '-'}</td>
          <td><button class="sm primary" data-act="r5Pick" data-pid="${p.id}" ${count40(my) < FORTY_MAX ? '' : 'disabled'}>指名</button></td></tr>`).join('')}</table></div>` : ''}
      ${R.picks.length ? `<h3>指名された選手</h3><ul class="news">${R.picks.map(x => `<li>${teamChip(S.teams[x.to])} ← ${teamChip(S.teams[x.from])} ${h(x.name)}</li>`).join('')}</ul>` : '<p class="muted">まだ指名はありません。</p>'}
      <h3>${h(my.short)}の取られるかもしれない選手（${myRisk.length}人）</h3>
      <p class="muted small">守りたい選手は、この画面に来る前（ノンテンダーの画面まで）に 40 人枠へ入れておく必要があります。</p>
      ${myRisk.length ? `<ul class="news">${myRisk.slice(0, 15).map(p => `<li>${nameCell(p)} ${posBadge(p)} <span class="muted">${p.age}歳・総合${Math.round(ovr(p))}</span></li>`).join('')}</ul>` : '<p class="muted">いません。</p>'}
      ${!mine ? '<p><button class="primary big" data-act="offNext">年俸調停へ ▶</button></p>' : ''}</section>`;
  } else if (O.step === 'arb') {
    const A = O.arb;
    body = `<section class="card"><h2>年俸調停（1〜2月）</h2>
      <p>選手と球団がそれぞれ年俸の額を出し、合わなければ調停で<b>どちらか一方の額</b>に決まります。調停は、選手の力と成績から見た相場に近いほうの額を選びます。球団の額を低くするほど、負けやすくなります。<b>負けると選手の額に決まり、忠誠心も少し下がります。</b></p>
      ${A.list.length ? `<div class="scroll"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>総合</th><th>今季の年俸</th><th>相場の見込み</th><th>選手の額</th><th>球団の額</th><th></th></tr>
        ${A.list.map((r, i) => { const p = S.players[r.pid]; if (!p) return ''; const v = UI.arbDraft[r.pid] != null ? UI.arbDraft[r.pid] : Math.round(r.fair * 0.95);
          return `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td>${p.age}</td><td>${Math.round(ovr(p))}</td><td>${U.money(p.salary)}</td><td>${U.money(r.fair)}</td><td>${U.money(r.ask)}</td>
          <td class="nowrap">${r.res ? (r.res.win === 'agree' ? '合意' : `${U.money(r.res.offer)}`) : `<input type="number" class="pay" data-chg="arbDraft" data-pid="${r.pid}" value="${v}" step="10">万ドル`}</td>
          <td class="nowrap">${r.res ? `<b>${U.money(r.res.salary)}</b> ${r.res.win === 'agree' ? '' : r.res.win === 'player' ? '<span class="neg">（選手の勝ち）</span>' : '<span class="win">（球団の勝ち）</span>'}` : `<button class="sm" data-act="arbAgree" data-i="${i}">選手の額で合意</button> <button class="sm primary" data-act="arbFile" data-i="${i}">この額で調停</button>`}</td></tr>`; }).join('')}</table></div>` : '<p class="muted">あなたのチームには、調停に入る選手がいません。</p>'}
      <p class="muted small">決めなかった選手は、締め切るときに相場の 0.95 倍の額で調停します。</p>
      <p><button class="primary big" data-act="offNext">締め切って国際アマ契約へ ▶</button></p></section>`;
  } else if (O.step === 'intl') {
    body = renderIntlAma();
  } else if (O.step === 'camp') {
    const over = t => t.players.length - ROSTER_MAX;
    const prob = count40(my) > FORTY_MAX ? `40人枠が${count40(my)}人です（${FORTY_MAX}人まで）。` : over(my) > 0 ? `選手が${my.players.length}人です（${ROSTER_MAX}人まで）。あと${over(my)}人、自由契約かトレードで減らしてください。` : null;
    body = `
    <section class="card"><h2>スプリングトレーニングの前の準備</h2>
      <p>いまの人数 <b>${my.players.length}人</b>（上限${ROSTER_MAX}人）・ 40人枠 <b>${count40(my)}/${FORTY_MAX}</b></p>
      ${prob ? `<p class="neg">${h(prob)}</p>` : ''}
      <p>トレード・自由契約選手の補強・自由契約・施設の改修・オーダーの見直しができます。準備ができたらスプリングトレーニングへ。</p>
      <button class="primary big" data-act="offNext" ${prob ? 'disabled' : ''}>スプリングトレーニングを行い ${S.year + 1}年シーズン開幕 ▶</button>
    </section>
    ${renderReleasePanel()}`;
  }
  return backupBanner() + bar + body + `<section class="card"><h2>ニュース</h2>${newsList(10)}</section>`;
}

// ドラフト候補の表（シーズン中のリストアップとドラフト本番で同じものを使う）
// mode: 'bid'（1 位入札）・'pick'（ウェーバーで指名）・false（見るだけ）
function prospectTable(ids, mode) {
  const pickable = !!mode;
  const pickBtn = p => `<button class="sm primary" data-act="draftPick" data-pid="${p.id}">指名</button>`;
  // 並び順も見立てで決める（本当の能力が並び順から漏れないように）
  const seen = seenOvr;
  const tierTag = p => { const t = draftTier(p); return `<span class="tier t${t[2]}">${t[1]}</span>`; };
  const watch = S.watch || [];
  let pool = ids.map(id => S.players[id]).filter(Boolean);
  if (UI.watchOnly) pool = pool.filter(p => watch.includes(p.id));
  pool = pool.filter(p => posMatch(p, UI.posf.draft));
  if (UI.pkind) pool = pool.filter(p => p.kind === UI.pkind);
  if (UI.geniusOnly) pool = pool.filter(geniusHint);
  pool.sort((a, b) => (watch.includes(b.id) - watch.includes(a.id)) || draftScore(b) - draftScore(a));
  const rows = pool.map(p => {
    const keys = abilKeys(p);
    const A = p.amateur;
    const on = watch.includes(p.id);
    return `<tr class="${on ? 'sel' : ''}"><td><button class="star-btn ${on ? 'on' : ''}" data-act="watch" data-pid="${p.id}" title="気になる">${on ? '★' : '☆'}</button></td>
      <td class="l"><b>${h(p.name)}</b>${p.twoWay ? '<span class="tag twoway">二刀流</span>' : ''}${rareTag(p)}</td><td>${p.kind}</td><td>${posBadge(p)}</td><td>${p.age}</td>
      <td>${geniusHint(p) ? '<span class="tag genius">天才肌？</span>' : ''}</td><td class="stars">${potLabel(p)}</td><td class="stars">${visualStars(p.visual)}</td>
      <td class="l">${keys.map(k => `${SHORT_LABEL[k]}${k === 'velo' ? veloKmh(scoutView(p, k)) + 'km' : `<span class="g g${U.grade(scoutView(p, k))}">${U.grade(scoutView(p, k))}</span>`}`).join(' ')} ${kireTag(p)}${trajTag(p)}</td>
      <td class="l wrap amateur"><div>${tierTag(p)}</div>${A ? `<div>${h(A.team)}</div><div>${h(A.line)}</div>${A.title ? `<div class="atitle">🏆 ${h(A.title)}</div>` : ''}` : ''}
        <div class="muted">講評：${h(scoutComment(p))}</div></td>
      ${pickable ? `<td>${pickBtn(p)}</td>` : ''}</tr>`;
  }).join('');
  const cards = isMobile() ? cardList(pool, p => {
    const A = p.amateur;
    const on = watch.includes(p.id);
    return playerCard(p, {
      cls: on ? 'sel' : '', view: true, noCond: true, ovr: Math.round(seen(p)),
      lead: `<button class="star-btn ${on ? 'on' : ''}" data-act="watch" data-pid="${p.id}">${on ? '★' : '☆'}</button>`,
      name: `<b>${h(p.name)}</b>${p.twoWay ? '<span class="tag twoway">二刀流</span>' : ''}${rareTag(p)}${geniusHint(p) ? '<span class="tag genius">天才肌？</span>' : ''}`,
      sub: `<span>${p.kind}</span><span class="muted">才能</span><span class="stars">${potLabel(p)}</span><span class="muted">ビジュアル</span><span class="stars">${visualStars(p.visual)}</span>`,
      lines: `<div class="pc-line">${tierTag(p)}</div>${A ? `<div class="pc-line">${h(A.team)}<br>${h(A.line)}</div>${A.title ? `<div class="pc-line atitle">🏆 ${h(A.title)}</div>` : ''}` : ''}<div class="pc-line muted">講評：${h(scoutComment(p))}</div>`,
      action: pickable ? pickBtn(p) : '',
    });
  }) : '';
  const nGenius = ids.map(id => S.players[id]).filter(p => p && geniusHint(p)).length;
  const kindN = k => ids.filter(id => S.players[id] && (!k || S.players[id].kind === k)).length;
  const kindSeg = `<div class="seg wrapseg">${[['', '出身すべて'], ...DRAFT_KINDS.map(([k]) => [k, k])].map(([k, n]) => `<button class="${UI.pkind === k ? 'on' : ''}" data-act="pkind" data-k="${k}">${n}（${kindN(k)}）</button>`).join('')}</div>`;
  const filters = `${posCounts()}${posFilter('draft')}${kindSeg}<div class="row" style="justify-content:flex-start">
    <label><input type="checkbox" data-chg="watchOnly" ${UI.watchOnly ? 'checked' : ''}> ★ 気になる選手だけ（${watch.filter(id => ids.includes(id)).length}人）</label>
    <label><input type="checkbox" data-chg="geniusOnly" ${UI.geniusOnly ? 'checked' : ''}> ✨ 天才肌の気配だけ（${nGenius}人）</label></div>`;
  if (isMobile()) return filters + cards;
  return `${filters}<div class="scroll"><table class="tbl"><tr><th>★</th><th>名前</th><th>出身</th><th>守</th><th>年</th><th>天才</th><th>才能</th><th>ビジュアル</th><th>能力（見立て）</th><th>評価・アマ時代の成績・スカウト講評</th>${pickable ? '<th></th>' : ''}</tr>${rows || '<tr><td colspan="11" class="muted">該当する選手はいません</td></tr>'}</table></div>`;
}

function scoutNote() {
  const lv = myTeam().fac.scout;
  return `スカウト Lv${lv}：見えている能力は、本当の能力から<b>最大 ±${scoutRange()}</b> ずれています（たいていはその半分くらい）。
    スカウトの段階を上げるほどずれが小さくなり、Lv5 ではほぼ正確です（Lv1 ±15 → Lv2 ±10 → Lv3 ±6 → Lv4 ±3 → Lv5 ±1）。成績とタイトルは事実なので、見立てと見比べてください。評価（ドライチ級など）と総評も見立てから出しています。`;
}

// ---------- 補強のおすすめ（ドラフト・自由契約） ----------
// ポジションごとに「人数・主力の力（リーグ平均とくらべて）・主力の年齢・若手の数」を見て点をつける
const NEED_TARGET = { 先発: 12, 中継ぎ: 16, 捕: 4, 一: 3, 二: 4, 三: 4, 遊: 4, 外: 10 }; // 70 人のときの目安の人数
function posValue(p, g) { return g === '先発' ? starterVal(p) : g === '中継ぎ' ? relVal(p) : batOvr(p); }

function draftNeeds() {
  const my = myTeam();
  const top = (t, g, n) => teamPlayers(t).filter(p => posMatch(p, g)).sort((a, b) => posValue(b, g) - posValue(a, g)).slice(0, n);
  return POS_GROUPS.map(g => {
    const all = teamPlayers(my).filter(p => posMatch(p, g));
    const n = g === '先発' ? 6 : g === '中継ぎ' ? 6 : g === '外' ? 3 : 1;   // 主力として見る人数
    const mine = top(my, g, n);
    const avg = list => (list.length ? U.sum(list, p => posValue(p, g)) / list.length : 0);
    const myLevel = avg(mine);
    const league = U.sum(S.teams, t => avg(top(t, g, n))) / S.teams.length;
    const old = mine.filter(p => p.age >= 32).length;
    const young = all.filter(p => p.age <= 23).length;
    const short = Math.max(0, NEED_TARGET[g] - all.length);
    const reasons = [];
    let score = 0;
    if (short > 0) { score += short * 2; reasons.push(`人数が少ない（${all.length}人・目安${NEED_TARGET[g]}人）`); }
    if (myLevel < league - 2) { score += (league - myLevel) / 2; reasons.push(`主力の力がリーグ平均より下（${Math.round(myLevel)}・平均${Math.round(league)}）`); }
    if (old > 0 && old >= Math.ceil(n / 2)) { score += old * 1.5; reasons.push(`主力の${old}人が32歳以上`); }
    if (young === 0) { score += 2; reasons.push('23歳以下の若手がいない'); } else if (young === 1) { score += 1; reasons.push('23歳以下の若手が1人だけ'); }
    return { g, score, reasons, count: all.length };
  }).sort((a, b) => b.score - a.score);
}

function needsCard(filterKey) {
  const needs = draftNeeds().filter(x => x.score > 0).slice(0, 3);
  if (!needs.length) return '<div class="needs"><b>📋 補強のおすすめ</b>：どのポジションもそろっています。いちばん力のある選手を取りましょう。</div>';
  return `<div class="needs"><b>📋 補強のおすすめ</b>（スカウト部長より）
    <ol>${needs.map(x => `<li><a href="#" data-act="posf" data-key="${filterKey}" data-g="${x.g}"><span class="pb pb-${x.g === '先発' || x.g === '中継ぎ' ? '投' : x.g}">${x.g}</span></a>
      ${x.reasons.map(h).join('・')}</li>`).join('')}</ol>
    <p class="muted small">ポジションの印を押すと、その候補だけに絞り込めます。</p></div>`;
}

// ---------- 今年のドラフトの総評（スカウト部長の見立て） ----------
const POS_WORD = { 捕: '捕手', 一: '一塁手', 二: '二塁手', 三: '三塁手', 遊: '遊撃手', 外: '外野手', 先発: '先発投手', 中継ぎ: '中継ぎ投手' };
function draftReview(ids) {
  const ps = ids.map(id => S.players[id]).filter(Boolean);
  if (!ps.length) return '';
  const top = ps.filter(p => draftScore(p) >= DRAFT_TOP);
  const pit = top.filter(p => p.isP).length, bat = top.length - pit;
  const word = (n, lo, hi) => (n >= hi ? '豊作' : n <= lo ? '不作' : '例年並み');
  const wp = word(pit, REVIEW_LINE.P[0], REVIEW_LINE.P[1]), wb = word(bat, REVIEW_LINE.B[0], REVIEW_LINE.B[1]);
  const lines = [];
  if (wp === wb) {
    lines.push(wp === '豊作' ? '今年は<b>投手・野手ともに豊作</b>。どの球団もいい選手が取れそうです。'
      : wp === '不作' ? '今年は<b>投手・野手ともに不作</b>。上位の選手は奪い合いになりそうです。'
        : '今年は投手・野手ともに<b>例年並み</b>です。');
  } else {
    lines.push(`今年は<b>投手が${wp}</b>、<b>野手は${wb}</b>です。`);
  }
  lines.push(`上位で消えそうな選手は ${top.length}人（投手${pit}人・野手${bat}人）。`);
  const stars = top.filter(p => draftTier(p)[2] === 1).sort((a, b) => draftScore(b) - draftScore(a)).slice(0, 3);
  lines.push(stars.length
    ? `目玉は${stars.map(p => `<b>${h(p.name)}</b>（${KIND_WORD[p.kind]}・${p.isP ? '投手' : POS_WORD[p.pos]}）`).join('、')}。指名の順番が早い球団が狙いそうです。`
    : '飛び抜けた目玉はおらず、全体1位は読めません。');
  // 出身ごとの多い・少ない（全体の割合とくらべて）
  const kinds = DRAFT_KINDS.map(([k]) => k).map(k => {
    const all = ps.filter(p => p.kind === k).length, t = top.filter(p => p.kind === k).length;
    return { k, t, r: top.length && all ? (t / top.length) / (all / ps.length) : 1 };
  }).sort((a, b) => b.r - a.r);
  if (kinds[0].r >= 1.3 && kinds[0].t >= 3) lines.push(`上位候補は${KIND_WORD[kinds[0].k]}が多め（${kinds[0].t}人）。`);
  const ready = ps.filter(p => p.kind !== '高校' && seenOvr(p) >= 54).length;
  lines.push(ready >= 30 ? `メジャーに近い大学生が${ready}人と多い年です。` : ready <= 12 ? `メジャーに近い選手は${ready}人と少なめで、育てて使う年です。` : `メジャーに近い選手は${ready}人。`);
  const thin = ['捕', '遊'].filter(g => !top.some(p => posMatch(p, g)));
  if (thin.length) lines.push(`上位候補に${thin.map(g => POS_WORD[g]).join('・')}がいません。`);
  // 補強したいポジションとの照らし合わせ
  const need = draftNeeds().find(x => x.score > 0);
  if (need) {
    const n = top.filter(p => posMatch(p, need.g)).length;
    lines.push(`うちが補強したい<b>${POS_WORD[need.g]}</b>は、上位候補に${n}人${n >= 4 ? 'いて、狙いやすい年です' : n === 0 ? 'もおらず、中位以下で探すことになりそうです' : 'います'}。`);
  }
  return `<div class="review"><b>📰 今年のドラフト総評</b>（スカウト部長より）<p>${lines.join('<br>')}</p></div>`;
}

function renderProspects() {
  if (S.phase === 'season' && S.draft) {
    return `<section class="card"><h2>ドラフト候補</h2><p>${S.draft.finished ? '今年のドラフトは終わりました。次の候補は開幕のときに発表されます。' : 'ドラフト会議中です。「ドラフト」の画面で指名してください。'}</p></section>${renderDraftHistory()}`;
  }
  if (S.phase !== 'season') return `<section class="card"><h2>ドラフト候補</h2><p>次の候補は開幕のときに発表されます。ドラフトは 7 月のオールスターの休みです。</p></section>${renderDraftHistory()}`;
  const ids = S.draftClass || [];
  return `
  <section class="card"><h2>${S.year}年 ドラフト候補</h2>
    <p>7 月のオールスターの休みのドラフト会議に出てくる選手です。☆を押すと「気になる選手」に入り、ドラフトで上に並びます。他球団に先に指名されるとニュースで知らせます。</p>
    <p class="muted">${scoutNote()}</p>
    ${draftReview(ids)}
    ${needsCard('draft')}
    ${prospectTable(ids, false)}
  </section>
  ${renderDraftHistory()}`;
}

// ドラフト採点の表（今年の採点と、過去の答え合わせで使う）
const GRADE_CLASS = { A: 'ga', B: 'gb', C: 'gc', D: 'gd', E: 'ge' };
const gradeMark = g => `<span class="dgrade ${GRADE_CLASS[g] || ''}">${g}</span>`;
function draftGradeCard(rows, title) {
  const sorted = rows.slice().sort((a, b) => b.pts - a.pts);
  return `<section class="card"><h2>📝 ${title}</h2>
    <p class="muted">スカウト部長の見立てで、指名した選手の評価を良い順に重みを付けて足し、30 球団の中の順位で A〜E を付けました（A 5 球団・B 7・C 8・D 6・E 4）。何年かたったら「ドラフト候補」の画面の下で答え合わせができます。</p>
    <div class="scroll"><table class="tbl"><tr><th>採点</th><th>球団</th><th>指名</th><th>点</th><th>ひとこと</th></tr>
    ${sorted.map(r => `<tr class="${r.id === S.myTeamId ? 'me' : ''}"><td>${gradeMark(r.grade)}</td><td class="l">${teamChip(S.teams[r.id])}</td><td>${r.n != null ? r.n : r.picks.length}人</td><td>${r.pts}</td><td class="l">${h(r.note || '')}</td></tr>`).join('')}
    </table></div></section>`;
}

// 過去のドラフトの答え合わせ
function renderDraftHistory() {
  const H = S.draftHist || [];
  if (!H.length) return '<section class="card"><h2>📝 過去のドラフト（答え合わせ）</h2><p class="muted">ドラフトが終わると、ここに採点が残ります。何年かたってから、指名した選手がどう育ったかを見比べられます。</p></section>';
  if (!H.some(x => x.year === UI.dhYear)) UI.dhYear = H[0].year;
  const y = H.find(x => x.year === UI.dhYear);
  const now = draftNow(y);
  const byId = id => now.find(r => r.id === id);
  const rows = y.rows.slice().sort((a, b) => byId(b.id).nowPts - byId(a.id).nowPts).map(r => {
    const n = byId(r.id);
    const up = n.grade < r.grade ? '⤴' : n.grade > r.grade ? '⤵' : '';
    return `<tr class="${r.id === S.myTeamId ? 'me' : ''}"><td class="l">${teamChip(S.teams[r.id])}</td><td>${gradeMark(r.grade)}</td><td>${gradeMark(n.grade)} ${up}</td>
      <td>${n.alive}/${n.n}人</td><td class="l">${n.best ? `${nameCell(n.best)} <span class="muted">総合${Math.round(ovr(n.best))}</span>` : '-'}</td><td>${n.titles || '-'}</td></tr>`;
  }).join('');
  const mine = y.rows.find(r => r.id === S.myTeamId);
  const myList = mine ? mine.picks.map((id, i) => {
    const p = S.players[id];
    return p ? `<li>${nameCell(p)} ${posBadge(p)} <span class="muted">${p.drafted ? `${p.drafted.round}位` : ''} ・ ${p.age}歳 ・ 総合${Math.round(ovr(p))}${p.teamId != null && p.teamId !== S.myTeamId ? ` ・ いまは${h(S.teams[p.teamId].short)}` : p.teamId == null ? ' ・ 自由契約' : ''}</span></li>`
      : `<li class="muted">${i + 1}人目：もういません（引退・退団）</li>`;
  }).join('') : '';
  return `<section class="card"><div class="row"><h2>📝 過去のドラフト（答え合わせ）</h2>
    <select data-chg="dhYear">${H.map(x => `<option value="${x.year}" ${x.year === UI.dhYear ? 'selected' : ''}>${x.year}年</option>`).join('')}</select></div>
    <p class="muted">「当時」はドラフト直後の採点、「いま」は指名した選手の今の総合（上位 3 人）とタイトルの数で付け直した採点です。引退した選手は数えません。</p>
    <div class="scroll"><table class="tbl"><tr><th>球団</th><th>当時</th><th>いま</th><th>残っている</th><th>いちばん育った選手</th><th>タイトル</th></tr>${rows}</table></div>
    ${mine ? `<h3>${h(myTeam().short)}が${y.year}年に指名した選手</h3><ul class="news">${myList}</ul>` : ''}</section>`;
}

function renderDraft() {
  const D = S.draft;
  if (!D) return '<section class="card"><h2>ドラフト</h2><p>ドラフト会議は 7 月のオールスターの休みです。</p></section>';
  const t = myTeam();
  const x = D.picks[D.idx];
  const myPicks = D.result.filter(r => r.team === t.id);
  const pool = draftPoolOf(t.id);
  const order = D.picks.filter(p => p.round === 1).map(p => `<li class="${p.team === t.id ? 'me' : ''}">${p.no}. ${teamChip(S.teams[p.team])}${p.note ? ` <span class="muted small">${h(p.note)}</span>` : ''}${D.result.find(r => r.no === p.no) ? ` ${h(D.result.find(r => r.no === p.no).name)}` : ''}</li>`).join('');
  let head, main = '';
  if (D.stage === 'pick') {
    head = `<h2>ドラフト ${draftRound()}巡目（全体${x ? x.no : '-'}番） ・ あなたの番です</h2>
      <p class="muted">指名の順番は去年の成績とロッタリーで決まっていて、どの巡目も同じ順です。${x && x.note ? `この指名：${h(x.note)}` : ''}</p>
      <p><button data-act="draftPass">選択終了（このあとは指名しない）</button></p>`;
    main = `<section class="card"><h2>候補選手</h2><p class="muted">${scoutNote()}</p>${draftReview(D.pool.concat(D.result.map(r => r.pid)))}${needsCard('draft')}${prospectTable(D.pool, 'pick')}</section>`;
  } else if (D.stage === 'sign') {
    const total = U.sum(myPicks, r => (D.bonus[r.pid] != null ? D.bonus[r.pid] : r.slot));
    head = `<h2>ドラフト 指名した選手と契約する</h2>
      <p>契約金の枠 <b>${U.money(pool)}</b>（指名した順位ごとの目安の合計）・ いまの合計 <b class="${total > pool * (1 + DRAFT_POOL_OVER) ? 'neg' : ''}">${U.money(total)}</b></p>
      <p class="muted">目安より高く出すと断られにくく、安くすると断られやすくなります（高校生は大学へ進むことがあります）。合計が枠を ${Math.round(DRAFT_POOL_OVER * 100)}% より多く超えると、超えた分の ${Math.round(DRAFT_TAX * 100)}% を払い、来年の 1 巡目の指名権を失います。断られたら、来年の同じ巡目に指名権が 1 つ増えます。</p>`;
    main = `<section class="card"><div class="scroll"><table class="tbl"><tr><th>巡目</th><th>名前</th><th>出身</th><th>守</th><th>目安</th><th>契約金</th><th>断る見込み</th></tr>
      ${myPicks.map(r => { const p = S.players[r.pid]; if (!p) return ''; const b = D.bonus[r.pid] != null ? D.bonus[r.pid] : r.slot;
        return `<tr><td>${r.round}（${r.no}）</td><td class="l">${nameCell(p)}</td><td>${KIND_WORD[p.kind]}</td><td>${posBadge(p)}</td><td>${U.money(r.slot)}</td>
        <td class="nowrap"><input type="number" class="pay" data-chg="draftBonus" data-pid="${r.pid}" value="${b}" step="5">万ドル</td><td>${Math.round(refuseChance(p, r.round, b / r.slot) * 100)}%</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">指名した選手はいません</td></tr>'}
      </table></div><p><button class="primary big" data-act="draftSign">契約を締め切る ▶</button></p></section>`;
  } else {
    head = `<h2>ドラフト終了</h2><p>契約金 ${U.money(D.spent || 0)}（枠 ${U.money(D.poolMine || pool)}）。指名した選手はマイナー（1A・2A）でプレーを始めます。</p>
      <p><button class="primary big" data-act="tab" data-tab="home">シーズンに戻る ▶</button></p>`;
    main = D.grades ? draftGradeCard(D.grades, '今年のドラフト採点') : '';
  }
  return `
  <div class="grid2">
    <section class="card">${head}
      ${myPicks.length ? `<h3>${h(t.short)}の指名</h3><ul class="news">${myPicks.map(r => `<li class="${r.refused ? 'muted' : ''}">${r.round}巡目（${r.no}） ${h(r.name)}（${KIND_WORD[r.kind]}・${r.pos}）${r.note ? ` <span class="tag">${h(r.note)}</span>` : ''}${r.refused ? ' → 断られました' : r.bonus ? ` 契約金${U.money(r.bonus)}` : ''}</li>`).join('')}</ul>` : ''}
    </section>
    <section class="card"><h2>1 巡目の順番</h2>${D.lottery && D.lottery.length ? `<p class="muted small">上位 ${LOTTERY_N} 番はロッタリーで決まりました。</p>` : ''}<ol class="plain">${order}</ol></section>
  </div>
  ${main}`;
}

// 1 巡目の入札と抽選の結果


// 自分が入札した回の結果を大きく見せる


// 戦力外通告（自由契約）の一覧。弱い順に並べ、その場で通告できる
function renderReleasePanel() {
  if (!releaseOpen()) return '';
  const t = myTeam();
  const over = t.players.length - ROSTER_MAX;
  const list = teamPlayers(t).sort((a, b) => tradeValue(a) - tradeValue(b));
  const rows = list.map(p => `<tr><td class="l">${nameCell(p)}</td><td>${posBadge(p)}</td><td class="nowrap">${p.age}${phaseMark(p)}</td><td class="stars">${potLabel(p)}</td>
    <td>${Math.round(ovr(p))}</td><td>${p.on40 ? U.money(p.salary) : 'マイナー'}</td><td>${p.on40 ? '40人枠' : '-'}${r5Eligible(p) ? '<br><span class="tag bad">ルール5対象</span>' : ''}</td>
    <td class="nowrap">${p.on40 ? `<button class="sm" data-act="dfa" data-pid="${p.id}">40人枠から外す</button>` : `<button class="sm" data-act="add40" data-pid="${p.id}" ${count40(t) < FORTY_MAX ? '' : 'disabled'}>40人枠に入れる</button>`}
      ${underContract(p) ? `<span class="muted small">契約中（あと${contractLeft(p)}年）</span>` : p.retireNext ? '<span class="muted small">引退する</span>' : `<button class="sm danger" data-act="release" data-pid="${p.id}">自由契約</button>`}</td></tr>`).join('');
  return `<section class="card"><h2>40人枠の出し入れ・自由契約</h2>
    <p>全体 <b>${t.players.length}人</b>（上限${ROSTER_MAX}人）・ 40人枠 <b>${count40(t)}/${FORTY_MAX}</b>${over > 0 ? ` ・ <span class="neg">開幕までにあと${over}人減らす必要があります</span>` : ''}</p>
    <p class="muted">トレード価値の低い順です。「40人枠から外す（DFA）」はウェーバーにかかり、ほかの球団が取らなければマイナー契約で残ります。<span class="tag bad">ルール5対象</span>の選手は、40 人枠に入れておかないと 12 月のルール 5 で取られることがあります。契約の途中の選手は自由契約にできません。</p>
    <div class="scroll release-list"><table class="tbl"><tr><th>名前</th><th>守</th><th>年</th><th>才能</th><th>総合</th><th>年俸</th><th>枠</th><th></th></tr>${rows}</table></div>
  </section>`;
}

// ---------- ポストシーズン ----------
function renderPost() {
  const P = S.post;
  const my = S.myTeamId;
  const card = s => {
    const top = S.teams[s.top], low = S.teams[s.low];
    const rule = SERIES_RULE[s.stage];
    // まだ見ていないユニバースシリーズの試合は「？」にして、勝ち数にも入れない
    const hid = g => g.pbi != null && pbpUnseen(g.pbi);
    const anyHid = s.games.some(hid);
    let wTop = 0, wLow = 0;
    const cut = s.games.findIndex(hid);
    const games = cut >= 0 ? s.games.slice(0, cut + 1) : s.games;
    const cells = games.map(g => {
      if (hid(g)) return '<td>？</td>';
      const ts = g.home === s.top ? g.score[1] : g.score[0], ls = g.home === s.top ? g.score[0] : g.score[1];
      if (ls > ts) wLow++; else wTop++;
      return `<td class="${ts > ls ? 'win' : ts < ls ? 'lose' : ''}">${ts}-${ls}${g.home === s.top ? '' : '<small>（敵地）</small>'}</td>`;
    }).join('');
    if (!anyHid) { wTop = s.wTop; wLow = s.wLow; }
    const mine = s.top === my || s.low === my;
    return `<div class="series ${mine ? 'mine' : ''}">
      <h3>${seriesLabel(s)}</h3>
      <p class="vsline">${teamChip(top)} ${h(top.name)} <b class="big-num">${wTop}</b> - <b class="big-num">${wLow}</b> ${h(low.name)} ${teamChip(low)}</p>
      <p class="muted">${rule.need}勝で勝ち抜け${s.stage === 'wc' ? '（全試合が上位の本拠地）' : s.stage === 'ds' ? '（2-2-1 の本拠地）' : '（2-3-2 の本拠地）'}
        ${s.done && !anyHid ? ` → <b>${h(S.teams[s.winner].name)}</b> ${s.stage === 'ws' ? `${FINAL_NAME}優勝！` : '勝ち抜け'}` : ''}</p>
      ${games.length ? `<div class="scroll"><table class="tbl"><tr>${games.map((_, i) => `<th>第${i + 1}戦</th>`).join('')}</tr><tr>${cells}</tr></table></div>` : '<p class="muted">これから</p>'}
      ${s.stage === 'ws' ? pbpButtons('ws') : ''}
    </div>`;
  };
  const stages = POST_STAGES.slice().reverse().filter(st => P.series.some(s => s.stage === st));
  const inIt = P.series.some(s => s.stage === P.stage && !s.done && (s.top === my || s.low === my));
  const seedList = lg => P.seeds[lg].map((id, i) => `<li class="${id === my ? 'me' : ''}">${i + 1}. ${teamChip(S.teams[id])} <span class="muted small">${i < 3 ? '地区優勝' : 'ワイルドカード'}・${S.teams[id].w}勝</span></li>`).join('');
  return `
  <section class="card"><h2>${S.year}年 ポストシーズン</h2>
    <p>${inIt ? '<b>あなたのチームが戦っています！</b>' : 'あなたのチームはいま試合がありません。最後まで見届けましょう。'}</p>
    ${stages.map(st => `<div class="grid2">${P.series.filter(s => s.stage === st).map(card).join('')}</div>`).join('')}
  </section>
  <section class="card"><h2>出場球団</h2><div class="grid2">${LEAGUES.map(lg => `<div><h3>${LEAGUE_NAME[lg]}</h3><ol class="plain">${seedList(lg)}</ol></div>`).join('')}</div>
    <p class="muted small">1・2 番は 1 回戦（ワイルドカードシリーズ）がありません。</p></section>
  ${S.lastGame && /シリーズ/.test(S.lastGame.label) && !(S.pbp || []).some(g => g.label === S.lastGame.label && !g.seen) ? `<section class="card"><h2>前の試合（${h(S.lastGame.label)}）</h2>${boxScore(S.lastGame)}</section>` : ''}
  <section class="card"><h2>ニュース</h2>${newsList(12)}</section>`;
}

function wcTable(lg, small) {
  const st = wildcardStand(lg).slice(0, small ? 6 : 12);
  return `<div class="scroll"><table class="tbl"><tr><th>順</th><th>球団</th><th>勝</th><th>敗</th><th>勝率</th><th>WC3位との差</th></tr>
  ${st.map((r, i) => `<tr class="${r.t.id === S.myTeamId ? 'me' : ''} ${i === 2 ? 'wcline' : ''}"><td>${i + 1}${i < 3 ? ' <span class="tag">WC</span>' : ''}</td><td class="l">${teamChip(r.t)}</td>
    <td>${r.t.w}</td><td>${r.t.l}</td><td>${pct(r.t).toFixed(3).replace(/^0/, '')}</td><td>${i < 3 ? '-' : r.gb.toFixed(1)}</td></tr>`).join('')}</table></div>`;
}

function renderIntlAma() {
  const I = S.off.intl, my = myTeam();
  const offers = I.offers;
  const used = U.sum(Object.keys(offers).filter(k => S.players[k] && !S.players[k].mv), k => offers[k].bonus);
  const asia = I.asia.map(id => S.players[id]).filter(Boolean);
  const pool = I.pool.map(id => S.players[id]).filter(Boolean).sort((a, b) => b.ask - a.ask);
  const offerCell = p => {
    const o = offers[p.id];
    if (o) return `<b>${p.mv ? `${o.years}年・年俸${U.money(o.salary)}` : `契約金${U.money(o.bonus)}`}</b> <button class="sm" data-act="intlCancel" data-pid="${p.id}">取り消す</button>`;
    const v = UI.intlDraft[p.id] != null ? UI.intlDraft[p.id] : p.mv || p.ask;
    return `<input type="number" class="pay" data-chg="intlDraft" data-pid="${p.id}" value="${v}" step="5">万ドル${p.mv ? ` <select data-chg="intlYears" data-pid="${p.id}">${U.range(1, CONTRACT_YEARS_MAX).map(y => `<option value="${y}" ${(UI.intlYears[p.id] || p.years) === y ? 'selected' : ''}>${y}年</option>`).join('')}</select>` : ''}
      <button class="sm primary" data-act="intlOffer" data-pid="${p.id}">申し込む</button>`;
  };
  const prow = p => `<tr class="${offers[p.id] ? 'sel' : ''}"><td class="l"><b>${h(p.name)}</b>${p.twoWay ? '<span class="tag twoway">二刀流</span>' : ''}${geniusHint(p) ? '<span class="tag genius">天才肌？</span>' : ''}</td><td>${h(p.nat)}</td><td>${posBadge(p)}</td><td>${p.age}</td><td class="stars">${potLabel(p)}</td>
    <td class="l">${abilKeys(p).map(k => `${SHORT_LABEL[k]}${k === 'velo' ? veloKmh(scoutView(p, k)) + 'km' : `<span class="g g${U.grade(scoutView(p, k))}">${U.grade(scoutView(p, k))}</span>`}`).join(' ')} ${kireTag(p)}</td>
    <td class="l wrap amateur"><div>${h(p.amateur.team)}</div><div>${h(p.amateur.line)}</div>${p.amateur.title ? `<div class="atitle">🏆 ${h(p.amateur.title)}</div>` : ''}<div class="muted">講評：${h(scoutComment(p))}</div></td>
    <td>${U.money(p.mv || p.ask)}${p.mv ? `<br><span class="muted small">${p.years}年の希望</span>` : ''}</td><td class="l nowrap">${offerCell(p)}</td></tr>`;
  const head = '<tr><th>名前</th><th>国</th><th>守</th><th>年</th><th>才能</th><th>能力（見立て）</th><th>経歴・講評</th><th>希望</th><th>あなたの条件</th></tr>';
  return `<section class="card"><h2>アジアのプロからのポスティング（${asia.length}人）</h2>
      <p>架空の日本・韓国のリーグの選手です。<b>25 歳以上</b>は FA と同じように年俸と年数を出し合い（取った球団は元の球団に譲渡金を払います：総額の 2500 万ドルまで 20%・5000 万ドルまで 17.5%・その上 15%）、<b>25 歳未満</b>は国際アマの契約金の枠で取ります。</p>
      <div class="scroll"><table class="tbl">${head}${asia.map(prow).join('')}</table></div></section>
    <section class="card"><h2>国際アマ契約（16 歳・${pool.length}人）</h2>
      <p>契約金の枠 <b>${U.money(intlPool(my))}</b>（市場が小さい球団ほど多い）・ 申し込み中 <b>${U.money(used)}</b> ・ 残り ${U.money(intlPool(my) - used)}</p>
      <p class="muted">締め切ると、評判の高い選手から順に、いちばん高い契約金を出した球団と契約します。希望の 7 割より安いと、どことも契約しません。16 歳なので、才能はドラフトよりさらに見えにくく、当たれば大きく、外れも多い選手たちです。${scoutNote()}</p>
      <div class="scroll"><table class="tbl">${head}${pool.slice(0, 80).map(prow).join('')}</table></div>
      ${pool.length > 80 ? `<p class="muted small">希望の契約金の高い 80 人を出しています。</p>` : ''}
      <p><button class="primary big" data-act="offNext">締め切ってスプリングトレーニングの準備へ ▶</button></p></section>`;
}

function renderAwaken(list) {
  const big = list.some(x => x.big);
  return `<div class="awaken-box ${big ? 'big' : ''}">
    <div class="awaken-title">${big ? '💥 大 覚 醒 💥' : list.every(x => x.limit) ? '🔓 上 限 解 放 🔓' : '⚡ 覚 醒 ⚡'}</div>
    ${list.map(x => `<p class="awaken-text ${x.big ? 'big' : ''}">${h(x.text)}</p>`).join('')}
    <p><button class="primary big" data-act="closeModal">${big ? 'すごすぎる！！' : 'やったね！'}</button></p>
  </div>`;
}

// いまの版と、どこから開いているか（更新されないときに見る）。値は main.js がオフライン用の仕組みから受け取る
let swReg = null;
let appVersion = '';
function versionLine() {
  return `<div class="version"><span>版：<b>${appVersion ? h(appVersion.replace('mlbm-', '')) : '（オフライン用の準備なし）'}</b></span>
    <span class="muted small">${h(location.host || 'ファイル')}</span>
    ${'serviceWorker' in navigator && location.protocol === 'https:' ? '<button class="sm" data-act="checkUpdate">🔄 新しい版を確かめる</button>' : ''}</div>`;
}

function renderMenu() {
  const others = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).filter(n => n !== currentSlot);
  return `<h2>メニュー</h2>
  ${versionLine()}
  <p>いま遊んでいるデータ：<b>スロット${currentSlot}</b>（試合を進めるたびに自動で保存しています）</p>
  <p><button data-act="saveNow">いま保存する</button></p>
  <h3>ファイルに書き出す（いちばん安心）</h3>
  <p class="muted">ブラウザのデータを消しても、書き出したファイルがあれば戻せます。Google ドライブ・iCloud・LINE の自分あてなどに置いておいてください。パソコンとスマホの間で移すのにも使えます。</p>
  <p><button class="primary" data-act="exportNow">💾 ファイルに書き出す</button>
    ${navigator.canShare ? '<button data-act="shareNow">📤 共有して送る（LINE・ドライブなど）</button>' : ''}</p>
  <p class="muted small">${lastExport(currentSlot) ? `最後に書き出したのは ${slotWhen(lastExport(currentSlot))}` : 'まだ書き出していません'}</p>
  <h3>ブラウザに消されにくくする設定</h3>
  <p>${storagePersisted === true ? '✅ オン（容量が足りないときなどに、ブラウザが勝手に消すことはありません）'
    : storagePersisted === 'unsupported' ? 'このブラウザではこの設定が使えません。ファイルへの書き出しで守ってください。'
      : '⚠️ オフ（ブラウザが許可しませんでした。ホーム画面に追加したアイコンから開くと、オンになりやすくなります）'}</p>
  <p class="muted small">この設定がオンでも、自分で閲覧データを消したときはセーブも消えます。</p>
  <h3>バックアップ（別のスロットへ）</h3>
  <p class="muted">いまのデータを別のスロットにも残せます。大事な場面の前に残しておくと、あとでそこからやり直せます。</p>
  <p>${others.map(n => { const m = slotMeta(n); return `<button data-act="copySlot" data-n="${n}">スロット${n}にコピー${m ? `（${h(m.team)} ${m.year}年を上書き）` : '（空き）'}</button>`; }).join(' ')}</p>
  <h3>収入の多さ</h3>
  <p><label>このデータ（スロット${currentSlot}）の収入
    <select data-chg="incomeLv">${Object.keys(INCOME_LEVELS).map(k => `<option value="${k}" ${(S.income || 'high') === k ? 'selected' : ''}>${INCOME_LEVELS[k].name}</option>`).join('')}</select></label></p>
  <p class="muted small">入場料・飲食・放映権・スポンサー・グッズの売上が、大を 100% として 中は ${Math.round(INCOME_LEVELS.mid.mul * 100)}%、小は ${Math.round(INCOME_LEVELS.low.mul * 100)}% になります。年俸や運営費は変わりません。30 球団みんなに効き、変えた日から効きます（スポンサーと全国の放映権は次の開幕から）。</p>
  <h3>そのほか</h3>
  <p><button data-act="toTitle">タイトルへ戻る</button></p>
  <p><button class="danger" data-act="reset">スロット${currentSlot}のデータを消す</button></p>`;
}

function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
