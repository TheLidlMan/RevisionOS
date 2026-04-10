import subprocess, json, sys, base64, os

token = os.environ.get("GITHUB_TOKEN", "")
owner = "TheLidlMan"
repo = "RevisionOS"
branch = "copilot/add-forgetting-curve-visualiser"

def api(method, path, data=None):
    cmd = ["curl", "-s", "-X", method,
           f"https://api.github.com{path}",
           "-H", f"Authorization: token {token}",
           "-H", "Accept: application/vnd.github+json"]
    if data:
        cmd += ["-d", json.dumps(data)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return {"raw": result.stdout, "err": result.stderr}

# Get the current commit SHA
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
parent = subprocess.run(["git", "rev-parse", "HEAD~1"], capture_output=True, text=True).stdout.strip()
print(f"HEAD={sha}, parent={parent}")

# Get the tree SHA 
tree = subprocess.run(["git", "rev-parse", "HEAD^{tree}"], capture_output=True, text=True).stdout.strip()
print(f"tree={tree}")

# Try to get the ref
ref_result = api("GET", f"/repos/{owner}/{repo}/git/refs/heads/{branch}")
print(f"Existing ref: {json.dumps(ref_result)[:200]}")

# Try updating the ref
update_result = api("PATCH", f"/repos/{owner}/{repo}/git/refs/heads/{branch}", {
    "sha": sha,
    "force": True
})
print(f"Update result: {json.dumps(update_result)[:300]}")
