// デモ画像を Supabase Storage にアップロード
// 実行: node scripts/upload-demo-images.mjs
// 事前に .env.local の NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY が必要

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// .env.local を手動パース（dotenv 不要）
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const imageDir = path.join(__dirname, 'demo-images')

async function uploadFiles(bucket, subdir, contentType) {
  const dir = path.join(imageDir, subdir)
  const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'))

  for (const file of files) {
    const filePath = path.join(dir, file)
    const fileBuffer = fs.readFileSync(filePath)
    const storagePath = `demo/${file}`

    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error(`  ERROR ${bucket}/${storagePath}:`, error.message)
    } else {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
      console.log(`  OK ${bucket}/${storagePath}`)
      console.log(`     URL: ${urlData.publicUrl}`)
    }
  }
}

async function main() {
  console.log('=== Supabase Storage アップロード ===')
  console.log(`URL: ${supabaseUrl}`)
  console.log('')

  console.log('avatars バケット:')
  await uploadFiles('avatars', 'avatars', 'image/jpeg')

  console.log('\nlogos バケット:')
  await uploadFiles('logos', 'logos', 'image/png')

  console.log('\n=== 完了 ===')
  console.log('\n以下のSQL用URL（SUPABASE_URL を置換してください）:')
  console.log(`Base URL: ${supabaseUrl}/storage/v1/object/public`)
  console.log('avatars: {base}/avatars/demo/{slug}.jpg')
  console.log('logos:   {base}/logos/demo/{filename}.png')
}

main().catch(console.error)
