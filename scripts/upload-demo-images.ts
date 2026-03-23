import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// .env.local を手動で読み込み（dotenv不要）
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE env vars in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function upload() {
  const imageDir = path.join(__dirname, 'demo-images')

  // avatars
  const avatarDir = path.join(imageDir, 'avatars')
  if (fs.existsSync(avatarDir)) {
    for (const file of fs.readdirSync(avatarDir)) {
      const buf = fs.readFileSync(path.join(avatarDir, file))
      const ext = path.extname(file).toLowerCase()
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
      const { error } = await supabase.storage
        .from('avatars')
        .upload(`demo/${file}`, buf, { contentType, upsert: true })
      if (error) console.error(`Error uploading avatar ${file}:`, error.message)
      else console.log(`Uploaded avatar: demo/${file}`)
    }
  }

  // logos
  const logoDir = path.join(imageDir, 'logos')
  if (fs.existsSync(logoDir)) {
    for (const file of fs.readdirSync(logoDir)) {
      const buf = fs.readFileSync(path.join(logoDir, file))
      const { error } = await supabase.storage
        .from('logos')
        .upload(`demo/${file}`, buf, { contentType: 'image/png', upsert: true })
      if (error) console.error(`Error uploading logo ${file}:`, error.message)
      else console.log(`Uploaded logo: demo/${file}`)
    }
  }

  // brand-assets
  const brandAssetsDir = path.join(imageDir, 'brand-assets')
  if (fs.existsSync(brandAssetsDir)) {
    for (const file of fs.readdirSync(brandAssetsDir)) {
      const buf = fs.readFileSync(path.join(brandAssetsDir, file))
      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(`demo/${file}`, buf, { contentType: 'image/png', upsert: true })
      if (error) console.error(`Error uploading brand-asset ${file}:`, error.message)
      else console.log(`Uploaded brand-asset: demo/${file}`)
    }
  }

  // concept-visuals（avatarsバケットのconcept-visualsフォルダ）
  const conceptDir = path.join(imageDir, 'concept-visuals')
  if (fs.existsSync(conceptDir)) {
    for (const file of fs.readdirSync(conceptDir)) {
      const buf = fs.readFileSync(path.join(conceptDir, file))
      const { error } = await supabase.storage
        .from('avatars')
        .upload(`concept-visuals/${file}`, buf, { contentType: 'image/png', upsert: true })
      if (error) console.error(`Error uploading concept-visual ${file}:`, error.message)
      else console.log(`Uploaded concept-visual: concept-visuals/${file}`)
    }
  }

  console.log('Upload complete!')
}

upload()
