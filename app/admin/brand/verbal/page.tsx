'use client'

// バーバルアイデンティティ 編集ページ（コミュニケーションスタイル＋表現ルール＋用語ルール）
// - コミュニケーションスタイル: brand_personalities.communication_style
// - 表現ルール: governance_rules の rule_type='tone_rule' のみ（claim_rule 等はオントロジー側の管轄）。
//   RLSで管理者は直接書けないため /api/brand/tone-rules 経由。削除は element_relations のエッジを巻き込む
// - 用語ルール: brand_terms
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import { splitCommunicationStyle, combineBrandCopy } from '@/lib/brand-mvv'
import { Plus, Trash2, Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Personality = {
  // コミュニケーションスタイルは「コピー＋説明文」を分けて編集（保存時に空行区切りで結合し communication_style 列へ）
  comm_copy: string
  comm_body: string
}

type TermItem = {
  preferred_term: string
  avoided_term: string
  context: string
  category: string
}

// 表現ルール（governance_rules の tone_rule）。id=null は未保存の新規行
type ToneRuleItem = {
  id: string | null
  rule_text: string
  ng_example: string
  ok_example: string
  severity: 'info' | 'warn' | 'block'
  edge_count: number
}

const SEVERITY_OPTIONS: Array<{ value: ToneRuleItem['severity']; label: string }> = [
  { value: 'info', label: '参考' },
  { value: 'warn', label: '原則遵守' },
  { value: 'block', label: '絶対遵守' },
]

type VerbalCache = {
  personalityId: string | null
  personality: Personality
  terms: TermItem[]
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

export default function VerbalIdentityPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-verbal-${companyId}`
  const cached = companyId ? getPageCache<VerbalCache>(cacheKey) : null
  const [personalityId, setPersonalityId] = useState<string | null>(cached?.personalityId ?? null)
  const [personality, setPersonality] = useState<Personality>(cached?.personality ?? { comm_copy: '', comm_body: '' })
  const [terms, setTerms] = useState<TermItem[]>(cached?.terms ?? [])
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)

  // 表現ルール（ページキャッシュとは独立に毎回API取得。id が安定している必要があるため）
  const [toneRules, setToneRules] = useState<ToneRuleItem[]>([])
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; rule: ToneRuleItem } | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)

  const fetchToneRules = async () => {
    try {
      const res = await fetch('/api/brand/tone-rules')
      if (!res.ok) return
      const data = await res.json()
      setToneRules((Array.isArray(data.rules) ? data.rules : []).map((r: Record<string, unknown>) => ({
        id: (r.id as string) || null,
        rule_text: (r.rule_text as string) || '',
        ng_example: (r.ng_example as string) || '',
        ok_example: (r.ok_example as string) || '',
        severity: (['info', 'warn', 'block'].includes(r.severity as string) ? r.severity : 'warn') as ToneRuleItem['severity'],
        edge_count: (r.edge_count as number) ?? 0,
      })))
    } catch {
      // 取得失敗時はセクションを空のまま表示（保存時にエラーで気づける）
    }
  }

  useEffect(() => {
    if (!companyId) return
    fetchToneRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const fetchData = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const [personalityRes, termsRes] = await Promise.all([
        // 新規企業は行が未作成のため maybeSingle（0件でもエラーにせず空フォーム表示）
        fetchWithRetry(() => supabase.from('brand_personalities').select('*').eq('company_id', companyId).maybeSingle()),
        fetchWithRetry(() => supabase.from('brand_terms').select('*').eq('company_id', companyId).order('sort_order')),
      ])
      if (personalityRes.error) throw new Error(personalityRes.error)
      if (termsRes.error) throw new Error(termsRes.error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const personalityData = personalityRes.data as Record<string, any> | null
      const termsData = termsRes.data as Record<string, unknown>[] | null

      // ポータルサブタイトル取得（入力UIは廃止。既存値の保持のため取得は継続）
      let fetchedSubtitle = ''
      let fetchedSubtitlesData: PortalSubtitles | null = null
      try {
        const { data: companyData } = await supabase
          .from('companies')
          .select('portal_subtitles')
          .eq('id', companyId)
          .single()
        if (companyData) {
          const subtitles = (companyData.portal_subtitles as PortalSubtitles) || null
          fetchedSubtitlesData = subtitles
          fetchedSubtitle = subtitles?.verbal || ''
          setPortalSubtitlesData(subtitles)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // サブタイトル取得失敗は無視
      }

      let parsedPersonalityId: string | null = null
      let parsedPersonality: Personality = { comm_copy: '', comm_body: '' }
      if (personalityData) {
        parsedPersonalityId = personalityData.id
        const comm = splitCommunicationStyle(personalityData.communication_style as string)
        parsedPersonality = { comm_copy: comm.copy, comm_body: comm.body }
        setPersonalityId(parsedPersonalityId)
        setPersonality(parsedPersonality)
      }

      let parsedTerms: TermItem[] = []
      if (termsData && termsData.length > 0) {
        parsedTerms = termsData.map((d: Record<string, unknown>) => ({
          preferred_term: (d.preferred_term as string) || '',
          avoided_term: (d.avoided_term as string) || '',
          context: (d.context as string) || '',
          category: (d.category as string) || '',
        }))
        setTerms(parsedTerms)
      }

      setPageCache(cacheKey, {
        personalityId: parsedPersonalityId,
        personality: parsedPersonality,
        terms: parsedTerms,
        portalSubtitle: fetchedSubtitle,
        portalSubtitlesData: fetchedSubtitlesData,
      })
    } catch (err) {
      console.error('[VerbalIdentity] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<VerbalCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  const updateCommunicationStyle = (field: 'comm_copy' | 'comm_body', value: string) => {
    setPersonality(prev => ({ ...prev, [field]: value }))
  }

  // --- 用語ルール操作 ---
  const existingCategories = useMemo(() => {
    const cats = terms.map(t => t.category).filter(c => c.trim() !== '')
    return [...new Set(cats)]
  }, [terms])

  const addTerm = () => {
    setTerms([...terms, { preferred_term: '', avoided_term: '', context: '', category: '' }])
  }

  const updateTerm = (index: number, field: keyof TermItem, value: string) => {
    const updated = [...terms]
    updated[index] = { ...updated[index], [field]: value }
    setTerms(updated)
  }

  const removeTerm = (index: number) => {
    setTerms(terms.filter((_, i) => i !== index))
  }

  // --- 表現ルール操作 ---
  const addToneRule = () => {
    setToneRules([...toneRules, { id: null, rule_text: '', ng_example: '', ok_example: '', severity: 'warn', edge_count: 0 }])
  }

  const updateToneRule = (index: number, field: 'rule_text' | 'ng_example' | 'ok_example' | 'severity', value: string) => {
    const updated = [...toneRules]
    updated[index] = { ...updated[index], [field]: value }
    setToneRules(updated)
  }

  const requestRemoveToneRule = (index: number) => {
    const rule = toneRules[index]
    if (!rule.id) {
      // 未保存の新規行はローカル削除のみ
      setToneRules(toneRules.filter((_, i) => i !== index))
      return
    }
    setDeleteTarget({ index, rule })
  }

  const confirmRemoveToneRule = async () => {
    if (!deleteTarget?.rule.id) return
    setDeletingRule(true)
    try {
      const res = await fetch(`/api/brand/tone-rules?id=${deleteTarget.rule.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '表現ルールの削除に失敗しました')
        return
      }
      setToneRules(prev => prev.filter((_, i) => i !== deleteTarget.index))
      toast.success(
        data.deletedEdges > 0
          ? `表現ルールを削除しました（関係グラフのエッジ ${data.deletedEdges} 本も削除）`
          : '表現ルールを削除しました'
      )
    } catch {
      toast.error('表現ルールの削除中にエラーが発生しました')
    } finally {
      setDeletingRule(false)
      setDeleteTarget(null)
    }
  }

  // Supabase REST API直接fetch
  const supabasePatch = async (table: string, id: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      return { ok: true }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const supabaseInsert = async (table: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      const result = await res.json()
      return { ok: true, data: result[0] }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

      // --- 1. コミュニケーションスタイル保存（brand_personalities） ---
      const personalityData: Record<string, unknown> = {
        company_id: companyId,
        communication_style: combineBrandCopy(personality.comm_copy, personality.comm_body) || null,
      }
      let pResult: { ok: boolean; error?: string; data?: Record<string, unknown> }
      if (personalityId) {
        pResult = await supabasePatch('brand_personalities', personalityId, personalityData, token)
      } else {
        pResult = await supabaseInsert('brand_personalities', personalityData, token)
        if (pResult.ok && pResult.data) {
          setPersonalityId(pResult.data.id as string)
        }
      }
      if (!pResult.ok) {
        throw new Error('コミュニケーションスタイル保存エラー: ' + pResult.error)
      }

      // --- 2. 用語ルール保存（全削除→全INSERT） ---
      const headers = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      }

      const delRes = await fetch(`${supabaseUrl}/rest/v1/brand_terms?company_id=eq.${companyId}`, {
        method: 'DELETE',
        headers,
      })
      if (!delRes.ok) {
        const body = await delRes.text()
        throw new Error(`用語削除エラー: HTTP ${delRes.status}: ${body}`)
      }

      const cleanedTerms = terms.filter(t => t.preferred_term.trim() !== '')
      if (cleanedTerms.length > 0) {
        const insertData = cleanedTerms.map((t, i) => ({
          company_id: companyId,
          preferred_term: t.preferred_term,
          avoided_term: t.avoided_term || null,
          context: t.context || null,
          category: t.category.trim() || null,
          sort_order: i,
        }))

        const insRes = await fetch(`${supabaseUrl}/rest/v1/brand_terms`, {
          method: 'POST',
          headers,
          body: JSON.stringify(insertData),
        })
        if (!insRes.ok) {
          const body = await insRes.text()
          throw new Error(`用語挿入エラー: HTTP ${insRes.status}: ${body}`)
        }
      }
      setTerms(cleanedTerms)

      // --- 3. 表現ルール保存（governance_rules tone_rule・API経由の差分UPSERT） ---
      // 未保存の新規行で空のものは除外。既存行のルール文が空ならエラー
      const rulesToSave = toneRules.filter(r => r.id || r.rule_text.trim())
      if (rulesToSave.some(r => r.id && !r.rule_text.trim())) {
        throw new Error('表現ルールのルール文は必須です')
      }
      if (rulesToSave.length > 0 || toneRules.length !== rulesToSave.length) {
        const ruleRes = await fetch('/api/brand/tone-rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules: rulesToSave.map(r => ({
              id: r.id || undefined,
              rule_text: r.rule_text,
              ng_example: r.ng_example,
              ok_example: r.ok_example,
              severity: r.severity,
            })),
          }),
        })
        if (!ruleRes.ok) {
          const body = await ruleRes.json().catch(() => ({}))
          throw new Error('表現ルール保存エラー: ' + (body.error || `HTTP ${ruleRes.status}`))
        }
        // 新規行に id を割り当てるため再取得
        await fetchToneRules()
      }

      // ポータルサブタイトルは入力UIを廃止。既存値はそのまま保持（再書き込みで温存）
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.verbal = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.verbal
      }
      await supabasePatch('companies', companyId, {
        portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
      }, token)
      setPortalSubtitlesData(updatedSubtitles)

      toast.success('保存しました')
    } catch (err) {
      console.error('[VerbalIdentity Save] エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* コミュニケーションスタイル（コピー＋説明文） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </CardContent>
        </Card>
        {/* 用語ルール（テーブル: ヘッダー行＋データ行） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-4 w-1/4" />)}
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-1/4 rounded-md" />
                <Skeleton className="h-10 w-1/4 rounded-md" />
                <Skeleton className="h-10 w-1/4 rounded-md" />
                <Skeleton className="h-10 w-1/4 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center p-10">
        <p className="text-red-600 text-sm mb-3">{fetchError}</p>
        <Button variant="outline" onClick={fetchData} className="py-2 px-4 text-[13px]">再読み込み</Button>
      </div>
    )
  }

  return (
    <div>
      {/* タイトルはヘッダーのパンくずに移管 */}
      <form id="verbal-form" onSubmit={handleSubmit} className="space-y-6">
        {/* カード1: コミュニケーションスタイル＋表現ルール（統合） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-8">
            {/* コミュニケーションスタイル */}
            <div>
            <h2 className="text-xs font-bold mb-3">コミュニケーションスタイル</h2>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">コピー（キャッチコピー・任意）</label>
                <Input
                  value={personality.comm_copy}
                  onChange={(e) => updateCommunicationStyle('comm_copy', e.target.value)}
                  placeholder="例：誠実に、まっすぐ伝える。"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">説明文</label>
                <AutoResizeTextarea
                  value={personality.comm_body}
                  onChange={(e) => updateCommunicationStyle('comm_body', e.target.value)}
                  placeholder="フォーマルだが親しみやすい、専門用語は最小限に..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            </div>

            {/* 表現ルール */}
            <div>
            <h2 className="text-xs font-bold mb-2">表現ルール</h2>
            <p className="text-xs text-muted-foreground mb-4">
              ブランドの語り口の制約ルール（NG例・OK例つき）を設定します。AIのコピー生成やパーソナリティ診断の連携で参照されます
            </p>

            <div className="space-y-3">
              {toneRules.map((rule, index) => (
                <div key={rule.id ?? `new-${index}`} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex gap-2 items-center mb-2">
                    <Input
                      value={rule.rule_text}
                      onChange={(e) => updateToneRule(index, 'rule_text', e.target.value)}
                      placeholder="ルール文（例：専門用語を使う際は必ず平易な言葉で補足する）"
                      className="h-10 flex-1"
                    />
                    <select
                      value={rule.severity}
                      onChange={(e) => updateToneRule(index, 'severity', e.target.value)}
                      className="h-10 w-[110px] shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {SEVERITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => requestRemoveToneRule(index)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={rule.ng_example}
                      onChange={(e) => updateToneRule(index, 'ng_example', e.target.value)}
                      placeholder="NG例"
                      className="h-10"
                    />
                    <Input
                      value={rule.ok_example}
                      onChange={(e) => updateToneRule(index, 'ok_example', e.target.value)}
                      placeholder="OK例"
                      className="h-10"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addToneRule} className="mt-3 gap-1">
              <Plus size={16} />表現ルールを追加
            </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表現ルール削除の確認ダイアログ（関係グラフのエッジ巻き込み削除を明示） */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>表現ルールを削除します</AlertDialogTitle>
              <AlertDialogDescription>
                「{deleteTarget?.rule.rule_text || '（無題のルール）'}」を削除します。
                {(deleteTarget?.rule.edge_count ?? 0) > 0 && (
                  <> 関連する関係グラフのエッジ{deleteTarget?.rule.edge_count}本も削除されます。</>
                )}
                {' '}この操作は元に戻せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingRule}>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmRemoveToneRule() }} disabled={deletingRule}>
                {deletingRule ? '削除中...' : '削除する'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* カード3: 用語ルール */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold mb-2">用語ルール</h2>
            <p className="text-xs text-muted-foreground mb-4">
              ブランドで使用する推奨用語と避けるべき用語を設定します
            </p>

            {/* ヘッダー行 */}
            {terms.length > 0 && (
              <div className="flex gap-2 mb-2">
                <span className="w-[140px] shrink-0 text-xs font-bold text-muted-foreground">カテゴリ</span>
                <span className="flex-1 text-xs font-bold text-muted-foreground">推奨用語</span>
                <span className="flex-1 text-xs font-bold text-muted-foreground">非推奨用語</span>
                <span className="flex-1 text-xs font-bold text-muted-foreground">使い分け説明</span>
                <span className="w-14" />
              </div>
            )}

            {terms.map((term, index) => (
              <div key={index} className="flex gap-2 mb-2 items-start">
                <Input
                  type="text"
                  list="term-categories"
                  value={term.category}
                  onChange={(e) => updateTerm(index, 'category', e.target.value)}
                  placeholder="カテゴリ"
                  className="h-10 w-[140px] shrink-0"
                />
                <Input
                  type="text"
                  value={term.preferred_term}
                  onChange={(e) => updateTerm(index, 'preferred_term', e.target.value)}
                  placeholder="推奨用語"
                  className="h-10 flex-1"
                />
                <Input
                  type="text"
                  value={term.avoided_term}
                  onChange={(e) => updateTerm(index, 'avoided_term', e.target.value)}
                  placeholder="非推奨用語"
                  className="h-10 flex-1"
                />
                <Input
                  type="text"
                  value={term.context}
                  onChange={(e) => updateTerm(index, 'context', e.target.value)}
                  placeholder="使い分け説明"
                  className="h-10 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeTerm(index)}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}

            <datalist id="term-categories">
              {existingCategories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>

            <Button
              type="button"
              variant="outline"
              onClick={addTerm}
              className="py-2 px-4 text-[13px]"
            >
              <Plus size={16} />用語ルールを追加
            </Button>
          </CardContent>
        </Card>

      </form>

      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定） */}
      <Fab>
        <FabButton type="submit" form="verbal-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>
    </div>
  )
}
