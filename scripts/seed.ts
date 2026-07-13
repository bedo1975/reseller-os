// seed.ts — initialise la base avec des données démo réalistes
// Marques : Ralph Lauren, Carhartt, Patagonia, Nike, Adidas, Levis, etc.

import { PrismaClient } from '@prisma/client'

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

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

async function main() {
  console.log('🌱 Début du seed...')

  await db.sale.deleteMany()
  await db.stockItem.deleteMany()
  await db.expense.deleteMany()
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
    const platformFees = salePrice * 0.08
    const profit = salePrice - item.purchaseCost - shippingCost - platformFees
    const margin = (profit / salePrice) * 100
    const saleDate = new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000)

    await db.sale.create({
      data: {
        stockItemId: item.id,
        saleDate,
        platform: pick(platforms, i),
        customerName: `Client ${i + 1}`,
        customerContact: `client${i + 1}@email.com`,
        salePrice: parseFloat(salePrice.toFixed(2)),
        shippingCost,
        platformFees: parseFloat(platformFees.toFixed(2)),
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
