const fs = require("fs");
const path = require("path");

function removeConsoleLog(content) {
  let result = "";
  let i = 0;
  while (i < content.length) {
    if (content.startsWith("console.log", i) || content.startsWith("console.warn", i)) {
      let start = i;
      let j = content.indexOf("(", i);
      if (j !== -1) {
        let count = 1;
        let k = j + 1;
        while (k < content.length && count > 0) {
          if (content[k] === "(") count++;
          else if (content[k] === ")") count--;
          k++;
        }
        if (count === 0) {
          // Check if followed by semicolon
          if (content[k] === ";") k++;
          i = k;
          // Clean up trailing whitespace/newline if the whole line is empty now
          continue;
        }
      }
    }
    result += content[i];
    i++;
  }
  return result;
}

function removeOrphanTodos(content) {
  // Matches // TODO or //TODO not followed by (#digits)
  return content.replace(/\/\/\s*TODO(?!\s*\(#\d+\)).*/g, "");
}

function removeCommentedCode(content) {
  // Matches lines starting with // followed by keywords
  return content.replace(
    /^\s*\/\/\s*(const|let|var|function|if|for|while|return|export|import|class|await|this\.|console\.).*/gm,
    ""
  );
}

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== "node_modules" && f !== ".next" && f !== "dist") {
        walk(dirPath, callback);
      }
    } else {
      if (f.endsWith(".ts") || f.endsWith(".tsx")) {
        callback(dirPath);
      }
    }
  });
}

const targetDirs = [path.join(process.cwd(), "src"), path.join(process.cwd(), "mobile", "src")];

targetDirs.forEach((dir) => {
  walk(dir, (filePath) => {
    let content = fs.readFileSync(filePath, "utf8");
    let original = content;

    content = removeConsoleLog(content);
    content = removeOrphanTodos(content);
    content = removeCommentedCode(content);

    if (content !== original) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Cleaned: ${filePath}`);
    }
  });
});
