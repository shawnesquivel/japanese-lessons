import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { packSchema, type FlashcardPack } from "./schema.js";

type StoreFile = {
  version: 1;
  packs: FlashcardPack[];
};

export interface PackStore {
  list(): Promise<FlashcardPack[]>;
  get(id: string): Promise<FlashcardPack | null>;
  save(pack: FlashcardPack): Promise<FlashcardPack>;
}

export class FilePackStore implements PackStore {
  constructor(private readonly filePath = resolve(process.cwd(), "data/packs.json")) {}

  private async read(): Promise<StoreFile> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as StoreFile;
      return {
        version: 1,
        packs: Array.isArray(parsed.packs) ? parsed.packs.map((pack) => packSchema.parse(pack)) : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, packs: [] };
      throw error;
    }
  }

  private async write(value: StoreFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }

  async list(): Promise<FlashcardPack[]> {
    return (await this.read()).packs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<FlashcardPack | null> {
    return (await this.read()).packs.find((pack) => pack.id === id) || null;
  }

  async save(pack: FlashcardPack): Promise<FlashcardPack> {
    const data = await this.read();
    const index = data.packs.findIndex((item) => item.id === pack.id);
    if (index === -1) data.packs.push(pack);
    else data.packs[index] = pack;
    await this.write(data);
    return pack;
  }
}
