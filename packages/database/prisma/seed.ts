import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando el proceso de Seeding...");

  const existingDataCount = await prisma.user.count();

  if (existingDataCount > 0) {
    console.log(
      `⏩ La base de datos ya contiene registros. Se omite la inyección del backup para evitar duplicados.`,
    );
    return; // Abortamos la ejecución limpiamente
  }

  const sqlFilePath = path.join(__dirname, "seed_data.sql");

  if (!fs.existsSync(sqlFilePath)) {
    console.warn(
      "⚠️ No se encontró seed_data.sql. Saltando el seeding de backup.",
    );
    return;
  }

  const rawSql = fs.readFileSync(sqlFilePath, { encoding: "utf-8" });

  // ✨ EL FIX: Dividimos el archivo gigante en sentencias individuales.
  // Cortamos por el punto y coma (;) seguido de un salto de línea
  // para evitar romper accidentalmente algún JSON que tenga un punto y coma adentro.
  const sqlStatements = rawSql.split(/;\s*[\r\n]+/);

  console.log(
    `📦 Se encontraron ${sqlStatements.length} sentencias SQL. Inyectando...`,
  );

  try {
    // Ejecutamos comando por comando. Prisma optimiza esto excelentemente por debajo.
    for (const statement of sqlStatements) {
      const cleanStatement = statement.trim();

      // Ignoramos las líneas vacías
      if (cleanStatement) {
        await prisma.$executeRawUnsafe(cleanStatement);
      }
    }
    console.log("✅ ¡Backup inyectado con éxito!");
  } catch (error) {
    console.error("❌ Error al inyectar una sentencia del backup:", error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
