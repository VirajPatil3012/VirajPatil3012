const https = require("https");
const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GITHUB_USERNAME || "VirajPatil3012";
const TOKEN = process.env.GITHUB_TOKEN;

const FEATURED_ORDER = [
  "email-writer-ai",
  "Smart-Parking-System",
  "LocalLingo"
];

function fetchGitHub(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: endpoint,
      headers: {
        "User-Agent": "VirajPatil-Profile-Updater",
        "Accept": "application/vnd.github+json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    };

    https
      .get(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);

            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`GitHub API ${res.statusCode}: ${JSON.stringify(parsed)}`));
              return;
            }

            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function getLanguages(repoName) {
  try {
    const langs = await fetchGitHub(`/repos/${USERNAME}/${repoName}/languages`);

    if (!langs || typeof langs !== "object" || Array.isArray(langs)) {
      return [];
    }

    const total = Object.values(langs).reduce((sum, bytes) => sum + bytes, 0);

    if (!total) {
      return [];
    }

    return Object.entries(langs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([lang, bytes]) => `${lang} (${Math.round((bytes / total) * 100)}%)`);
  } catch (error) {
    console.error(`Could not retrieve languages for ${repoName}:`, error.message);
    return [];
  }
}

function escapeMarkdown(text = "") {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function getFeaturedRepos(repos) {
  const featuredMap = new Map(
    repos
      .filter(
        (repo) =>
          !repo.fork &&
          Array.isArray(repo.topics) &&
          repo.topics.includes("featured")
      )
      .map((repo) => [repo.name, repo])
  );

  const ordered = FEATURED_ORDER
    .map((name) => featuredMap.get(name))
    .filter(Boolean);

  const remaining = repos
    .filter(
      (repo) =>
        !repo.fork &&
        Array.isArray(repo.topics) &&
        repo.topics.includes("featured") &&
        !FEATURED_ORDER.includes(repo.name)
    )
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  return [...ordered, ...remaining];
}

async function buildProjectCard(repo) {
  const langs = await getLanguages(repo.name);
  const langBadges = langs.map((lang) => `\`${lang}\``).join(" ");

  const liveLink = repo.homepage
    ? `\n\n[🌐 Live Demo](${repo.homepage})`
    : "";

  return `
<td width="50%" valign="top">

### 📦 [${escapeMarkdown(repo.name.replace(/-/g, " "))}](${repo.html_url})

${escapeMarkdown(repo.description || "Project description coming soon.")}

**Languages Used:**  
${langBadges || `\`${repo.language || "Multi-language"}\``}

<br/>

[💻 Source Code](${repo.html_url})${liveLink}

</td>`;
}

async function main() {
  const repos = await fetchGitHub(
    `/users/${USERNAME}/repos?per_page=100&sort=pushed`
  );

  if (!Array.isArray(repos)) {
    throw new Error("Failed to retrieve repositories.");
  }

  const featured = getFeaturedRepos(repos);

  if (featured.length === 0) {
    console.log("No repositories with the 'featured' topic were found.");
    return;
  }

  const cards = [];

  for (const repo of featured) {
    cards.push(await buildProjectCard(repo));
  }

  let tableContent = "<table width=\"100%\">\n<tr>\n";

  for (let i = 0; i < cards.length; i++) {
    tableContent += cards[i] + "\n";

    if ((i + 1) % 2 === 0 && i + 1 < cards.length) {
      tableContent += "</tr>\n<tr>\n";
    }
  }

  if (cards.length % 2 !== 0) {
    tableContent += '<td width="50%" valign="top"></td>\n';
  }

  tableContent += "</tr>\n</table>";

  const readmePath = path.join(__dirname, "../README.md");
  let readme = fs.readFileSync(readmePath, "utf8");

  const regex = /<!--START_PROJECTS-->[\s\S]*?<!--END_PROJECTS-->/;

  if (!regex.test(readme)) {
    throw new Error(
      "README.md is missing <!--START_PROJECTS--> and <!--END_PROJECTS--> markers."
    );
  }

  readme = readme.replace(
    regex,
    `<!--START_PROJECTS-->\n${tableContent}\n<!--END_PROJECTS-->`
  );

  fs.writeFileSync(readmePath, readme, "utf8");

  console.log(
    `README.md updated successfully with ${featured.length} featured project(s).`
  );
}

main().catch((error) => {
  console.error("Profile updater failed:", error);
  process.exit(1);
});
