// パーソナリティ診断 コピー定義（アーキタイプ12種＋Aaker 5次元）
// 文言は 260611_アーキタイプ12種_コピー定義_v1.md から逐語コピー。変更は北川さん承認後のみ。
// 用途: AI診断プロンプトの語彙ソース（ステージ2）＋結果カード表示（ステージ3）。
// label / copy はAI出力を信用せず、key からこの定義表の文言に強制上書きする。

export type ArchetypeKey =
  | 'hero' | 'sage' | 'explorer' | 'magician' | 'innocent' | 'jester'
  | 'lover' | 'caregiver' | 'ruler' | 'creator' | 'outlaw' | 'everyman'

export interface ArchetypeDefinition {
  key: ArchetypeKey
  label: string
  copy: string
  description: string
  keywords: [string, string, string]
  /** カード表示には使わない。AIが tone_of_voice / tone_rules を生成する際の参照値 */
  tone_hint: string
}

export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    key: 'hero',
    label: '英雄',
    copy: '逆境こそ、私たちの舞台。',
    description: '困難な課題に正面から挑み、努力と実力で世界を前へ進める人格。顧客に「勇気」と「達成」を約束し、共に勝つ体験を届けます。',
    keywords: ['挑戦', '克服', '誇り'],
    tone_hint: '力強く断言する。弱音より行動を語る',
  },
  {
    key: 'sage',
    label: '賢者',
    copy: '真実が、最良の道しるべ。',
    description: '知識と洞察で物事の本質を見抜き、人々を賢くする人格。確かな根拠と分析で、迷いに答えを示します。',
    keywords: ['知性', '真実', '洞察'],
    tone_hint: '落ち着いて論理的に。データと事実で語る',
  },
  {
    key: 'explorer',
    label: '探検家',
    copy: 'まだ見ぬ場所へ、最初の一歩を。',
    description: '自由を愛し、新しい体験と発見を追い求める人格。枠にとらわれない選択肢を顧客の前に開きます。',
    keywords: ['自由', '発見', '冒険'],
    tone_hint: '好奇心のままに、開放的に語る',
  },
  {
    key: 'magician',
    label: '魔術師',
    copy: '不可能を、目の前で変えてみせる。',
    description: 'ビジョンと技術で変革を起こし、夢を現実にする人格。顧客の「変わりたい」という願いに、驚きをもって応えます。',
    keywords: ['変革', 'ビジョン', '驚き'],
    tone_hint: '未来を描き、変化を約束する',
  },
  {
    key: 'innocent',
    label: '無垢',
    copy: '正直で、まっすぐで、それがいちばん。',
    description: '純粋さと楽観で、シンプルな幸せを届ける人格。裏表のなさが、何よりの安心と信頼になります。',
    keywords: ['純粋', '安心', '楽観'],
    tone_hint: '飾らず、明るく、やさしい言葉で',
  },
  {
    key: 'jester',
    label: '道化',
    copy: '真面目な世界に、笑いをひとさじ。',
    description: '楽しさとユーモアで人々の心を軽くする人格。「今この瞬間を楽しむ」価値を真剣に届けます。',
    keywords: ['楽しさ', 'ユーモア', '軽やかさ'],
    tone_hint: '遊び心たっぷりに、ウィットを効かせて',
  },
  {
    key: 'lover',
    label: '恋人',
    copy: '五感に響く、特別な時間を。',
    description: '情熱と美意識で、親密で豊かな体験をつくる人格。「選ばれる悦び」を顧客とのあいだに育てます。',
    keywords: ['情熱', '美', '親密'],
    tone_hint: '感性に訴え、情緒豊かに語る',
  },
  {
    key: 'caregiver',
    label: '援助者',
    copy: 'あなたのために、そばにいる。',
    description: '思いやりと献身で人を支える人格。守られている安心感を、関わるすべての人に約束します。',
    keywords: ['思いやり', '支援', '安心'],
    tone_hint: '温かく寄り添い、相手を主語に語る',
  },
  {
    key: 'ruler',
    label: '支配者',
    copy: '基準を作る者で、あり続ける。',
    description: '秩序と品質で業界をリードする人格。揺るがない基準と統率力が、権威と安定を体現します。',
    keywords: ['品格', '統率', '安定'],
    tone_hint: '堂々と、格調高く、簡潔に',
  },
  {
    key: 'creator',
    label: '創造者',
    copy: '想像したものは、形にできる。',
    description: '創造性と完成度への執念で、新しい価値を生み出す人格。本物のものづくりだけを約束します。',
    keywords: ['創造', '完成度', '独自性'],
    tone_hint: '美学とこだわりを、具体に込めて語る',
  },
  {
    key: 'outlaw',
    label: '反逆者',
    copy: '常識は、壊すためにある。',
    description: '既存のルールに挑み、業界の当たり前を覆す人格。変化を求める顧客の、最も頼れる代弁者です。',
    keywords: ['革命', '挑発', '自由'],
    tone_hint: '挑発的に、本音で、歯に衣着せず',
  },
  {
    key: 'everyman',
    label: '仲間',
    copy: '特別じゃなくていい、一緒にいよう。',
    description: '等身大の誠実さで、誰にでも開かれた存在であろうとする人格。共感とつながりの輪を広げます。',
    keywords: ['共感', '等身大', 'つながり'],
    tone_hint: '飾らない日常の言葉で、対等に',
  },
]

export const ARCHETYPE_BY_KEY: Record<ArchetypeKey, ArchetypeDefinition> = Object.fromEntries(
  ARCHETYPES.map(a => [a.key, a])
) as Record<ArchetypeKey, ArchetypeDefinition>

export type AakerDimension = 'sincerity' | 'excitement' | 'competence' | 'sophistication' | 'ruggedness'

export interface AakerDefinition {
  dimension: AakerDimension
  label: string
  copy: string
  description: string
}

export const AAKER_DIMENSIONS: AakerDefinition[] = [
  {
    dimension: 'sincerity',
    label: '誠実',
    copy: '嘘がない、だから選ばれる。',
    description: '正直さ・健全さ・温かみ。約束を守り、地に足のついた信頼を築く力。高いブランドは「誠実な友人」として認知されます。',
  },
  {
    dimension: 'excitement',
    label: '刺激',
    copy: '次は何を見せてくれるのか。',
    description: '大胆さ・想像力・最先端。人をワクワクさせ、期待を生み続ける力。高いブランドは「目が離せない存在」になります。',
  },
  {
    dimension: 'competence',
    label: '能力',
    copy: '任せて安心、頼れる実力。',
    description: '信頼性・知性・成功。プロフェッショナルとしての確かさ。高いブランドは「間違いのない選択」として選ばれます。',
  },
  {
    dimension: 'sophistication',
    label: '洗練',
    copy: '細部に宿る、上質という品格。',
    description: '上質さ・魅力・美意識。憧れを生むエレガンス。高いブランドは「持つこと・選ぶことが誇りになる存在」です。',
  },
  {
    dimension: 'ruggedness',
    label: '素朴',
    copy: '飾らない強さ、本物のタフさ。',
    description: '質実剛健・実直・たくましさ。虚飾のない本物感。高いブランドは「無骨だが裏切らない相棒」と感じられます。',
  },
]

export const AAKER_BY_DIMENSION: Record<AakerDimension, AakerDefinition> = Object.fromEntries(
  AAKER_DIMENSIONS.map(d => [d.dimension, d])
) as Record<AakerDimension, AakerDefinition>

/** 期待印象タグの確定8語（これ以外はバリデーションで弾く） */
export const EXPECTED_TAG_VOCABULARY = [
  '信頼感', '革新的', '親しみやすい', '専門的', '洗練', '情熱的', '堅実', '遊び心',
] as const
