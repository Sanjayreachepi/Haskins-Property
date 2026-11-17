import "dotenv/config";
import mysql from "mysql2/promise";
export const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "haskins_db",
  connectionLimit: 10,
});
export async function rows(sql: string, values: any[] = []): Promise<any[]> {
  const [result] = await db.execute(sql, values);
  return result as any[];
}
