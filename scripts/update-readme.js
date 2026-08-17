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
        "User-Agent": "NodeJS-Readme-Updater",
        ...(TOKEN ? { Authorization: `token ${TOKEN}` } : {}),
      },
    };
    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function getLanguages(repoName) {
  try {
    const langs = await fetchGitHub(`/repos/${USERNAME}/${repoName}/languages`);
    if (!langs || typeof langs !== "object" || Array.isArray(langs)) return [];
    
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
  if (!Array.isArray(repos)) {
    console.error("Failed to retrieve repositories:", repos);
    return;
  }

  // Filter repositories tagged with the topic 'featured'
  const featured = repos.filter(
    (r) => Array.isArray(r.topics) && r.topics.includes("featured")
  );

  if (featured.length === 0) {
    console.log("No repositories found with the 'featured' topic.");
    return;
  }

  let tableContent = '<table width="100%">\n<tr>\n';

  for (let i = 0; i < featured.length; i++) {
    const repo = featured[i];
    const langs = await getLanguages(repo.name);
    const langBadges = langs.map((l) => `\`${l}\``).join(" ");
    
    // Only shows live demo button if a website URL is configured in the repository settings
    const liveLink = repo.homepage
      ? ` &nbsp;•&nbsp; [🌐 Live Demo](${repo.homepage})`
      : "";

    tableContent += `
<td width="50%" valign="top">

### 📦 [${repo.name.replace(/-/g, " ")}](${repo.html_url})

${repo.description || "No description provided."}

**Languages Used:**  
${langBadges || `\`${repo.language || "Multi-language"}\``}

<br/>

[💻 Source Code](${repo.html_url})${liveLink}

</td>\n`;

    // Break every 2 cards into a new table row
    if ((i + 1) % 2 === 0 && i + 1 < featured.length) {
      tableContent += "</tr>\n<tr>\n";
    }
  }

  // Balance out table if there is an odd number of projects
  if (featured.length % 2 !== 0) {
    tableContent += '<td width="50%" valign="top"></td>\n';
  }

  tableContent += "</tr>\n</table>";

  const readmePath = path.join(__dirname, "../README.md");
  let readme = fs.readFileSync(readmePath, "utf8");

  const regex = /<!--START_PROJECTS-->[\s\S]*?<!--END_PROJECTS-->/;
  if (!regex.test(readme)) {
    console.error("Markers <!--START_PROJECTS--> and <!--END_PROJECTS--> not found in README.md");
    return;
  }

  readme = readme.replace(
    regex,
    `<!--START_PROJECTS-->\n${tableContent}\n<!--END_PROJECTS-->`
  );

  fs.writeFileSync(readmePath, readme);
  console.log("README.md featured projects section updated successfully.");
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
