// seed.js — Version JavaScript du seed (compatible Windows sans tsx)
// Initialise la base avec des données démo réalistes
// Marques : Ralph Lauren, Carhartt, Patagonia, Nike, Adidas, Levis, etc.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

const suppliers = [
  { name: 'Grossiste X', type: 'grossiste', contact: 'Marc Dubois', phone: '06 12 34 56 78', email: 'contact@grossistex.fr', address: '12 rue du Commerce, Lyon' },
  { name: 'Friperie du Centre', type: 'friperie', contact: 'Sophie Martin', phone: '06 23 45 67 89', address: '45 rue principale, Marseille' },
  { name: 'Déstockage Pro', type: 'destockeur', contact: 'Karim B.', phone: '06 34 56 78 90', address: 'Zone industrielle, Lille' },
  { name: 'Vide-grenier Vincennes', type: 'vide-grenier', contact: 'Bénévole', address: 'Place de Vincennes, Paris' },
  { name: 'Particulier — Leboncoin', type: 'particulier', contact: 'Anonyme' },
  { name: 'Stock Luxe Paris', type: 'grossiste', contact: 'Élodie Roux', phone: '06 78 90 12 34', address: '8 avenue Montaigne, Paris' },
]

const stockSeed = [
  { sku: 'RL-POLO-00125', brand: 'Ralph Lauren', category: 'vetements', size: 'L', color: 'Bleu marine', condition: 'tres-bon', purchaseCost: 12 },
  { sku: 'CH-COAT-00487', brand: 'Carhartt', category: 'vetements', size: 'M', color: 'Camel', condition: 'bon', purchaseCost: 28 },
  { sku: 'PA-FLEECE-00231', brand: 'Patagonia', category: 'vetements', size: 'L', color: 'Gris', condition: 'tres-bon', purchaseCost: 18 },
  { sku: 'NK-AIRMAX-01002', brand: 'Nike', category: 'chaussures', size: '42', color: 'Noir/Blanc', condition: 'bon', purchaseCost: 25 },
  { sku: 'AD-SAMBA-00554', brand: 'Adidas', category: 'chaussures', size: '43', color: 'Noir', condition: 'tres-bon', purchaseCost: 22 },
  { sku: 'LV-501-00789', brand: 'Levis', category: 'vetements', size: '32', color: 'Bleu', condition: 'bon', purchaseCost: 14 },
  { sku: 'RL-SHIRT-00312', brand: 'Ralph Lauren', category: 'vetements', size: 'M', color: 'Blanc', condition: 'neuf', purchaseCost: 16 },
  { sku: 'CH-BEANIE-00198', brand: 'Carhartt', category: 'accessoires', size: 'TU', color: 'Noir', condition: 'neuf', purchaseCost: 8 },
  { sku: 'NK-TECH-00654', brand: 'Nike', category: 'vetements', size: 'L', color: 'Noir', condition: 'tres-bon', purchaseCost: 20 },
  { sku: 'PA-JACKET-00421', brand: 'Patagonia', category: 'vetements', size: 'M', color: 'Vert', condition: 'bon', purchaseCost: 35 },
  { sku: 'AD-TRACK-00218', brand: 'Adidas', category: 'vetements', size: 'S', color: 'Gris', condition: 'tres-bon', purchaseCost: 19 },
  { sku: 'LV-TRUCK-00877', brand: 'Levis', category: 'vetements', size: 'L', color: 'Noir', condition: 'bon', purchaseCost: 21 },
  { sku: 'RL-COAT-00999', brand: 'Ralph Lauren', category: 'vetements', size: 'XL', color: 'Beige', condition: 'tres-bon', purchaseCost: 45 },
  { sku: 'CH-PANTS-00155', brand: 'Carhartt', category: 'vetements', size: '34', color: 'Marron', condition: 'bon', purchaseCost: 26 },
  { sku: 'NK-CAP-00456', brand: 'Nike', category: 'accessoires', size: 'TU', color: 'Rouge', condition: 'neuf', purchaseCost: 9 },
]

const platforms = ['vinted', 'leboncoin', 'ebay', 'vestiaire']
const carriers = ['mondial_relay', 'chronopost', 'colissimo', 'dhl']
const statuses = ['A_PHOTOGRAPHIER', 'A_REDIGER', 'PRET_A_PUBLIER', 'PUBLIE', 'RESERVE', 'VENDU']
const parcelStatuses = ['A_PREPARER', 'A_IMPRIMER', 'A_DEPOSER', 'EN_TRANSIT', 'LIVRE', 'PROBLEME']

function pick(arr, seed) {
  return arr[seed % arr.length]
}

async function main() {
  console.log('🌱 Début du seed...')

  await db.sale.deleteMany()
  await db.stockItem.deleteMany()
  await db.expense.deleteMany()
  await db.attribute.deleteMany()
  await db.supplier.deleteMany()

  const createdSuppliers = await Promise.all(
    suppliers.map(s => db.supplier.create({ data: s }))
  )
  console.log(`✅ ${createdSuppliers.length} fournisseurs créés`)

  const now = new Date()
  const createdItems = []
  for (let i = 0; i < stockSeed.length; i++) {
    const s = stockSeed[i]
    const supplier = createdSuppliers[i % createdSuppliers.length]
    const purchaseDate = new Date(now.getTime() - (i + 5) * 24 * 60 * 60 * 1000)
    const status = i < 10 ? 'VENDU' : pick(statuses, i + 2)
    const item = await db.stockItem.create({
      data: {
        sku: s.sku,
        barcode: `345${String(i + 1).padStart(10, '0')}`,
        photos: JSON.stringify([
          `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80`,
        ]),
        brand: s.brand,
        category: s.category,
        size: s.size,
        color: s.color,
        condition: s.condition,
        purchaseDate,
        supplierId: supplier.id,
        purchaseCost: s.purchaseCost,
        lotReference: `LOT-${Math.floor(i / 3) + 1}-2026`,
        warehouse: i % 2 === 0 ? 'Entrepôt Principal' : 'Entrepôt Annex',
        rack: `Rack ${String.fromCharCode(65 + (i % 4))}`,
        shelf: `${(i % 4) + 1}`,
        bin: `${(i % 12) + 1}`,
        status,
        platform: status === 'PUBLIE' || status === 'VENDU' ? pick(platforms, i) : null,
        suggestedPrice: s.purchaseCost * 2.5 + (i % 5) * 5,
        description: `${s.brand} ${s.category} ${s.size} ${s.color} — état ${s.condition}. Article authentique.`,
        measurements: JSON.stringify({ longueur: 70, largeur: 55, manche: 25 }),
      },
    })
    createdItems.push(item)
  }
  console.log(`✅ ${createdItems.length} articles créés`)

  let salesCount = 0
  for (let i = 0; i < 10; i++) {
    const item = createdItems[i]
    const salePrice = item.purchaseCost * 2.5 + (i % 5) * 5 + 5
    const shippingCost = 4.95
    const platform = pick(platforms, i)
    // Frais variables (%) + frais fixes par plateforme
    const platformFeesPct = platform === 'vinted' ? 0.05 : platform === 'ebay' ? 0.13 : platform === 'vestiaire' ? 0.15 : 0
    const platformFixedFees = platform === 'vinted' ? 0.70 : platform === 'ebay' ? 0.35 : 0
    const platformFees = salePrice * platformFeesPct
    const totalFees = platformFees + platformFixedFees
    const profit = salePrice - item.purchaseCost - shippingCost - totalFees
    const margin = (profit / salePrice) * 100
    const saleDate = new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000)

    await db.sale.create({
      data: {
        stockItemId: item.id,
        saleDate,
        platform,
        customerName: `Client ${i + 1}`,
        customerContact: `client${i + 1}@email.com`,
        salePrice: parseFloat(salePrice.toFixed(2)),
        shippingCost,
        platformFees: parseFloat(platformFees.toFixed(2)),
        platformFixedFees: parseFloat(platformFixedFees.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        margin: parseFloat(margin.toFixed(1)),
        carrier: pick(carriers, i),
        trackingNumber: `MR${String(1000000 + i * 137)}`,
        parcelStatus: pick(parcelStatuses, i + 1),
        notes: '',
      },
    })
    salesCount++

    await db.stockItem.update({
      where: { id: item.id },
      data: {
        status: 'VENDU',
        platform: pick(platforms, i),
      },
    })
  }
  console.log(`✅ ${salesCount} ventes créées`)

  // 4b. Attributs par défaut pour le module Settings
  const defaultAttrs = [
    // Catégories
    { type: 'category', value: 'Vêtements', code: 'vetements', isDefault: true },
    { type: 'category', value: 'Chaussures', code: 'chaussures', isDefault: false },
    { type: 'category', value: 'Accessoires', code: 'accessoires', isDefault: false },
    { type: 'category', value: 'Luxe', code: 'luxe', isDefault: false },
    { type: 'category', value: 'Maison', code: 'maison', isDefault: false },
    // États
    { type: 'condition', value: 'Neuf avec étiquette', code: 'neuf', isDefault: true },
    { type: 'condition', value: 'Très bon état', code: 'tres-bon', isDefault: false },
    { type: 'condition', value: 'Bon état', code: 'bon', isDefault: false },
    { type: 'condition', value: 'État correct', code: 'correct', isDefault: false },
    // Tailles
    { type: 'size', value: 'XS', code: 'XS', isDefault: false },
    { type: 'size', value: 'S', code: 'S', isDefault: false },
    { type: 'size', value: 'M', code: 'M', isDefault: true },
    { type: 'size', value: 'L', code: 'L', isDefault: false },
    { type: 'size', value: 'XL', code: 'XL', isDefault: false },
    { type: 'size', value: 'XXL', code: 'XXL', isDefault: false },
    { type: 'size', value: 'TU', code: 'TU', isDefault: false },
    { type: 'size', value: '32', code: '32', isDefault: false },
    { type: 'size', value: '34', code: '34', isDefault: false },
    { type: 'size', value: '36', code: '36', isDefault: false },
    { type: 'size', value: '38', code: '38', isDefault: false },
    { type: 'size', value: '40', code: '40', isDefault: false },
    { type: 'size', value: '42', code: '42', isDefault: false },
    { type: 'size', value: '43', code: '43', isDefault: false },
    { type: 'size', value: '44', code: '44', isDefault: false },
    // Couleurs
    { type: 'color', value: 'Noir', code: 'Noir', isDefault: false },
    { type: 'color', value: 'Blanc', code: 'Blanc', isDefault: false },
    { type: 'color', value: 'Gris', code: 'Gris', isDefault: false },
    { type: 'color', value: 'Bleu marine', code: 'Bleu marine', isDefault: true },
    { type: 'color', value: 'Bleu', code: 'Bleu', isDefault: false },
    { type: 'color', value: 'Rouge', code: 'Rouge', isDefault: false },
    { type: 'color', value: 'Vert', code: 'Vert', isDefault: false },
    { type: 'color', value: 'Beige', code: 'Beige', isDefault: false },
    { type: 'color', value: 'Marron', code: 'Marron', isDefault: false },
    { type: 'color', value: 'Camel', code: 'Camel', isDefault: false },
    // Transporteurs avec URL de suivi
    { type: 'carrier', value: 'Mondial Relay', code: 'mondial_relay', isDefault: true, trackingUrl: 'https://www.mondialrelay.fr/suivi-de-colis?NumeroExpedition={tracking}' },
    { type: 'carrier', value: 'Chronopost', code: 'chronopost', isDefault: false, trackingUrl: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={tracking}' },
    { type: 'carrier', value: 'Colissimo', code: 'colissimo', isDefault: false, trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}' },
    { type: 'carrier', value: 'DHL', code: 'dhl', isDefault: false, trackingUrl: 'https://www.dhl.com/fr/fr/home/tracking/tracking-parcel.html?submit=1&tracking-id={tracking}' },
    { type: 'carrier', value: 'UPS', code: 'ups', isDefault: false, trackingUrl: 'https://www.ups.com/track?tracknum={tracking}' },
  ]

  // Grouper par type pour calculer sortOrder
  const attrsByType = {}
  for (const a of defaultAttrs) {
    if (!attrsByType[a.type]) attrsByType[a.type] = []
    attrsByType[a.type].push(a)
  }
  let attrCount = 0
  for (const [type, list] of Object.entries(attrsByType)) {
    for (let i = 0; i < list.length; i++) {
      await db.attribute.create({
        data: { ...list[i], type, sortOrder: i },
      })
      attrCount++
    }
  }
  console.log(`✅ ${attrCount} attributs créés`)

  const expenses = [
    { category: 'abonnement', label: 'Abonnement Vinted Pro', amount: 9.99 },
    { category: 'frais_port', label: 'Mondial Relay lot 10 étiquettes', amount: 35.50 },
    { category: 'fourniture', label: 'Papier bulle + cartons', amount: 28.00 },
    { category: 'carburant', label: 'Trajet dépôt colis', amount: 12.00 },
    { category: 'abonnement', label: 'eBay Store', amount: 19.99 },
    { category: 'fourniture', label: 'Étiquettes QR code', amount: 14.50 },
  ]
  for (const e of expenses) {
    await db.expense.create({
      data: {
        ...e,
        date: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    })
  }
  console.log(`✅ ${expenses.length} dépenses créées`)

  console.log('🌱 Seed terminé avec succès !')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
