// コピーAI 尖り度マトリクス（役割→生成ディレクティブの設定）。
// 役割（hero_h1 など）ごとに「尖り度・ペルソナ・態度表明・陳腐句モード・主要評価軸・craft下限・案数」を定義し、
// buildCopySystemPrompt() で system プロンプトに展開する。Stage3（批評）も craftFloor/primaryAxis を再利用する。
export type CopyRole = 'hero_h1' | 'section_heading' | 'body_copy' | 'cta' | 'form_microcopy';
export type StanceMode = 'required' | 'recommended' | 'none' | 'forbidden';
export type ClicheMode = 'strict' | 'standard' | 'off';
export type Register = 'casual' | 'neutral' | 'formal' | 'reverent';

export type RoleSpec = {
  label: string; sharpness: number; persona: string;
  stance: StanceMode; cliche: ClicheMode;
  primaryAxis: 'tension_stance' | 'differentiation' | 'specificity' | 'politeness';
  craftFloor: number; candidates: number;   // hero_h1 は3案
};

export const COPY_ROLE_MATRIX: Record<CopyRole, RoleSpec> = {
  hero_h1:         { label:'ファーストビュー見出し', sharpness:100, persona:'狂犬',
                     stance:'required',    cliche:'strict',   primaryAxis:'tension_stance', craftFloor:70, candidates:3 },
  section_heading: { label:'セクション見出し',     sharpness:70,  persona:'変革者',
                     stance:'recommended', cliche:'standard', primaryAxis:'differentiation', craftFloor:60, candidates:1 },
  body_copy:       { label:'説明文・本文',         sharpness:40,  persona:'賢者・援助者',
                     stance:'none',        cliche:'standard', primaryAxis:'specificity',    craftFloor:50, candidates:1 },
  cta:             { label:'ボタン',               sharpness:0,   persona:'誠実な執事',
                     stance:'forbidden',   cliche:'off',      primaryAxis:'politeness',     craftFloor:0,  candidates:3 },
  form_microcopy:  { label:'入力補助文',           sharpness:0,   persona:'誠実な執事',
                     stance:'forbidden',   cliche:'off',      primaryAxis:'politeness',     craftFloor:0,  candidates:1 },
};

const STANCE_DIRECTIVE: Record<StanceMode, string> = {
  required:
    '【態度表明：必須】既存業界が当然としている常識を1つ名指しで否定し、その代替となる独自の立場を断言せよ。' +
    '「〜しませんか？」のような問いかけや一般論で逃げることを禁ずる。読み手が一瞬ひるむ強度を狙え。' +
    'ただし否定の対象は「業界の通念・常識」であり、特定競合の名指し批判は禁止。',
  recommended:
    '【態度表明：推奨】問いを立てるか、ビフォー/アフターの状態変化を提示し、フラットな説明にとどめないこと。',
  none:
    '【態度表明：不要】主張で押さず、事実とロジックで淡々と納得させよ。誇張・煽りは禁止。',
  forbidden:
    '【態度表明：厳禁】主張・煽り・気の利いた言い回しを一切排し、迷いをゼロにする最短の案内に徹せよ。',
};

const CLICHE_DIRECTIVE: Record<ClicheMode, string> = {
  strict:
    '【陳腐句：厳格ブロック】後述の禁止語・業界クリシェを1語でも含めたら失格。' +
    '言い換えではなく、その概念を具体的な事実・情景に置換せよ。',
  standard:
    '【陳腐句：警告】禁止語・クリシェの多用を避ける。使う場合は必ず固有の事実で裏打ちすること。',
  off:
    '【陳腐句：許容】定番表現でよい。奇をてらわず、機能と次の動作が即わかる言葉を選べ。',
};

const REGISTER_DIRECTIVE: Record<Register, string> = {
  casual:   '【語の品格：カジュアル】砕けた口語。ただし軽薄にしない。',
  neutral:  '【語の品格：標準】ビジネス標準。硬すぎず砕けすぎず。',
  formal:   '【語の品格：フォーマル】丁寧・端正。敬体を基本に。',
  reverent: '【語の品格：荘厳】格調高く、品位を保つ。',
};

// Q3: コピペ防止の本体（全役割共通で必ず注入）
export const INTENT_TRANSLATION_RULE = `# 言い換え原則（最重要・違反は即失格）
あなたは「意味の翻訳者」であり、文字の運び屋ではない。
1. INTENT素材（理念・バリュー・行動指針・提供価値の文言）の語・フレーズを、1つもそのまま出力に使うな（部分一致も不可）。
2. 各INTENT素材は頭の中で次の3手順を踏め（出力には書かない）:
   (a)抽出: 読み手にとって「何が起きる/防げる」かの1文の事実に還元
   (b)投影: ペルソナの昨日あった具体的場面・感情・口ぐせに置換
   (c)接地: 可能ならFACT素材（実績・数字）で裏打ちし、抽象語を情景に変える
3. 抽象名詞（"価値""体験""ソリューション""最適化""寄り添う"）で終わるな。具体に言い換えよ。
4. FACT素材の数字・固有名詞だけは原文どおり引用してよい（積極的に使え）。FACTに無い数字の創作は禁止。
自己チェック: 各文が「素材の言い換えか、コピペか」を内省し、コピペが残れば書き直してから出力せよ。`;

export function buildCopySystemPrompt(opts: {
  role: CopyRole; register: Register;
  intentBlock: string; factBlock: string; rulesBlock: string; personaBlock: string;
  aspirationBlock?: string;                 // §9 未来の素材（0件なら注入しない＝従来と同一出力）
  clicheList: string;                       // 禁止語＋クリシェ（strict時に効かせる）
  brief?: string; chosenInsight?: string; chosenAngle?: string;
}): string {
  const spec = COPY_ROLE_MATRIX[opts.role];
  const lines = [
    `あなたは日本トップクラスのコピーライターです。役割は「${spec.persona}」。`,
    `この枠（${spec.label}）の尖り度目標は ${spec.sharpness}/100 です。`,
    STANCE_DIRECTIVE[spec.stance],
    CLICHE_DIRECTIVE[spec.cliche],
    spec.cliche === 'strict' ? `# 禁止語・クリシェ（1語でも使えば失格）\n${opts.clicheList}` : '',
    REGISTER_DIRECTIVE[opts.register],
    INTENT_TRANSLATION_RULE,
    opts.brief ? `\n# 案件の狙い\n${opts.brief}` : '',
    opts.chosenInsight ? `# 刺すべき本音\n${opts.chosenInsight}` : '',
    opts.chosenAngle ? `# 採用した切り口\n${opts.chosenAngle}` : '',
    `\n# 意図の素材（INTENT・引用禁止：意味だけ抜け）\n${opts.intentBlock}`,
    `# 引用してよい事実（FACT・数字/固有名詞はここからのみ）\n${opts.factBlock || '（登録された実績なし。事実の創作は禁止。抽象語に逃げず、無いものは言わない）'}`,
    // §9 ASPIRATION は FACT と物理的に別セクション。0件なら行ごと出さない（従来プロンプトと完全一致）。
    opts.aspirationBlock
      ? `# 目指す姿（ASPIRATION・まだ事実ではない）\n${opts.aspirationBlock}\n` +
        `※ASPIRATION は目指す姿・未来であって実績ではない。「目指す」「これから」の形でのみ言及してよい。` +
        `事実として断定したり、ここから数字・成果を引用してはならない。引用してよい事実は FACT ブロックのみ。`
      : '',
    `# 守るべきルール（違反は失格）\n${opts.rulesBlock || '（特になし）'}`,
    `# 読み手（この人の日常語で書け）\n${opts.personaBlock || '（ペルソナ未登録。一般的な読み手を想定）'}`,
    `\n出力は本文のみ。説明・前置きをしない。` +
      (spec.candidates > 1 ? `${spec.candidates}案を改行区切りで出力（番号や記号を付けない）。` : ''),
  ];
  return lines.filter(Boolean).join('\n');
}
