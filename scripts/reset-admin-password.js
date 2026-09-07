const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const newPassword = 'admin123'  // ← change ce que tu veux

  const hashed = await bcrypt.hash(newPassword, 10)

  // Update the first admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin) {
    console.log('❌ Aucun utilisateur admin trouvé')
    return
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashed },
  })

  console.log('✅ Mot de passe réinitialisé !')
  console.log('   Email:', admin.email)
  console.log('   Nouveau mot de passe:', newPassword)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())