import fs from "fs";
import path from "path";

export interface AboutHonor {
  title: string;
  year: string;
  icon: string;
}

export interface AboutContact {
  label: string;
  detail: string;
  url: string;
  icon: string;
}

export interface AboutContent {
  history: string[];
  honors: AboutHonor[];
  contacts: AboutContact[];
}

const contentDir = path.join(process.cwd(), "src/content/about");

const emptyAbout: AboutContent = {
  history: [],
  honors: [],
  contacts: [],
};

export function getAboutContent(locale: string = "zh"): AboutContent {
  const preferred = path.join(contentDir, `${locale}.json`);
  const fallback = path.join(contentDir, "zh.json");
  const filePath = fs.existsSync(preferred) ? preferred : fallback;

  if (!fs.existsSync(filePath)) {
    return emptyAbout;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<AboutContent>;
    return {
      history: Array.isArray(raw.history) ? raw.history.map(String) : [],
      honors: Array.isArray(raw.honors)
        ? raw.honors.map((item) => ({
            title: String(item?.title || ""),
            year: String(item?.year || ""),
            icon: String(item?.icon || "🏆"),
          }))
        : [],
      contacts: Array.isArray(raw.contacts)
        ? raw.contacts.map((item) => ({
            label: String(item?.label || ""),
            detail: String(item?.detail || ""),
            url: String(item?.url || "#"),
            icon: String(item?.icon || "🔗"),
          }))
        : [],
    };
  } catch {
    return emptyAbout;
  }
}
