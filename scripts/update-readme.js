const https = require("https");
const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GITHUB_USERNAME || "VirajPatil3012";
const TOKEN = process.env.GITHUB_TOKEN;

function fetchGitHub(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: endpoint,
      headers: {
        "User-Agent": "NodeJS-Script",
        ...(TOKEN ? { Authorization: `token ${TOKEN}` } : {}),
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

async function getLanguages(repoName) {
  try {
    const langs = await fetchGitHub(`/repos/${USERNAME}/${repoName}/languages`);
    const total = Object.values(langs).reduce((a, b) => a + b, 0);
    if (!total) return [];
    return Object.entries(langs)
      .slice(0, 4)
      .map(([lang, bytes]) => `${lang} (${Math.round((bytes / total) * 100)}%)`);
  } catch {
    return [];
  }
}

async function main() {
  const repos = await fetchGitHub(`/users/${USERNAME}/repos?per_page=100&sort=pushed`);
  if (!Array.isArray(repos)) return;

  const featured = repos.filter(r => r.topics && r.topics.includes("featured"));
  if (featured.length === 0) return;

  let tableContent = '<table width="100%">\n<tr>\n';

  for (let i = 0; i < featured.length; i++) {
    const repo = featured[i];
    const langs = await getLanguages(repo.name);
    const langBadges = langs.map(l => `\`${l}\``).join(" ");
    const liveLink = repo.homepage ? ` &nbsp;•&nbsp; [🌐 Live Demo](${repo.homepage})` : "";

    tableContent += `
<td width="50%" valign="top">

### 📦 [${repo.name.replace(/-/g, " ")}](${repo.html_url})

${repo.description || "No description provided."}

**Languages Used:**  
${langBadges || `\`${repo.language || "Multi-language"}\``}

<br/>

[💻 Source Code](${repo.html_url})${liveLink}

</td>\n`;

    if ((i + 1) % 2 === 0 && i + 1 < featured.length) {
      tableContent += '</tr>\n<tr>\n';
    }
  }

  if (featured.length % 2 !== 0) {
    tableContent += '<td width="50%" valign="top"></td>\n';
  }

  tableContent += '</tr>\n</table>';

  const readmePath = path.join(__dirname, "../README.md");
  let readme = fs.readFileSync(readmePath, "utf8");

  const regex = /<!--START_PROJECTS-->[\s\S]*?<!--END_PROJECTS-->/;
  readme = readme.replace(regex, `<!--START_PROJECTS-->\n${tableContent}\n<!--END_PROJECTS-->`);

  fs.writeFileSync(readmePath, readme);
}

main().catch(console.error);