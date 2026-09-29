import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function run() {
  const csvPath = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/795a933f-3029-48a4-b0cd-6f0f9b6c6f33/.system_generated/steps/1451/content.md'
  const csvData = fs.readFileSync(csvPath, 'utf-8')
  
  // Extract CSV lines skipping header
  const lines = csvData.split('\n')
  const startIdx = lines.findIndex(l => l.startsWith('City Code,'))
  if (startIdx === -1) throw new Error("CSV Header not found")
  
  const csvRows = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = []
    let inQuotes = false
    let current = ''
    for (let c of line) {
        if (c === '"') {
            inQuotes = !inQuotes
        } else if (c === ',' && !inQuotes) {
            parts.push(current)
            current = ''
        } else {
            current += c
        }
    }
    parts.push(current)
    csvRows.push({
      cityCode: parts[0],
      storeName: parts[1],
      glovoId: parts[2] !== '-' ? parts[2] : null,
      address: parts[3]?.trim(),
      woltId: parts[6] !== '-' ? parts[6] : null,
      boltId: parts[7] !== '-' ? parts[7] : null,
    })
  }

  // Load DB dump
  const dbData = JSON.parse(fs.readFileSync('dump.json'))
  
  let updatedCount = 0
  
  for (const dbRow of dbData) {
    if (dbRow.address) continue; // Already has address
    
    // Try to match by Wolt ID, then Bolt ID, then Glovo ID
    let matchedCsv = null;
    if (dbRow.wolt_url) {
        matchedCsv = csvRows.find(r => r.woltId && dbRow.wolt_url.includes(r.woltId))
    }
    if (!matchedCsv && dbRow.glovo_url) {
        matchedCsv = csvRows.find(r => r.glovoId && dbRow.glovo_url.includes(r.glovoId))
    }
    if (!matchedCsv && dbRow.bolt_url) {
        matchedCsv = csvRows.find(r => r.boltId && dbRow.bolt_url.includes(r.boltId))
    }
    
    // If no URL match, try fuzzy matching name and city
    if (!matchedCsv) {
        const brandMap = {
            'Poki Woki': 'Poki-Woki',
            'Roll Master': 'Roll Master',
            'Love Sushi': 'Love Sushi',
            'Smash Me': 'Smash Me',
            'Crunch': 'Crunch'
        }
        
        for (const csvRow of csvRows) {
            const dbBrand = Object.keys(brandMap).find(b => dbRow.name.includes(b))
            if (dbBrand && brandMap[dbBrand] === csvRow.storeName) {
                // Check city match roughly
                const cityMap = {
                    'BUC': 'BUC', 'TIM': 'TIM', 'CLJ': 'CLJ', 'IAS': 'IAS', 'CTA': 'CONSTANTA', 
                    'BCU': 'BACAU', 'BRV': 'BRASOV', 'BRL': 'BRAILA', 'BTO': 'BOTOSANI',
                    'CRB': 'CORBEANCA', 'CRV': 'CRAIOVA', 'GLT': 'GALATI', 'ORD': 'ORADEA',
                    'PIT': 'PITESTI', 'PTN': 'PIATRA', 'SBU': 'SIBIU', 'SCV': 'SUCEAVA',
                    'TGM': 'TARGU', 'TUL': 'TULCEA'
                }
                const csvCityPrefix = cityMap[csvRow.cityCode]
                if (csvCityPrefix && dbRow.name.toUpperCase().includes(csvCityPrefix)) {
                    matchedCsv = csvRow
                    break
                }
            }
        }
    }
    
    if (matchedCsv && matchedCsv.address) {
        console.log(`Updating ${dbRow.name} -> ${matchedCsv.address}`)
        const { error } = await supabase.from('restaurants').update({ address: matchedCsv.address }).eq('id', dbRow.id)
        if (error) {
            console.error(`Failed to update ${dbRow.name}:`, error)
        } else {
            updatedCount++
        }
    } else {
        console.log(`Could not map ${dbRow.name}`)
    }
  }
  
  console.log(`Updated ${updatedCount} addresses.`)
}

run()
