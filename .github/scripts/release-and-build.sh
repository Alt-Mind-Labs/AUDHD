#!/usr/bin/env bash
set -euo pipefail

echo "🛠 Starting web-app build for commit $GITHUB_SHA"

# 1) make sure we have all tags locally
git fetch --tags
# 2) if this was a manual dispatch (no “before”), diff against HEAD^
if [[ -z "${GITHUB_EVENT_BEFORE:-}" ]]; then
  GITHUB_EVENT_BEFORE=$(git rev-parse HEAD^)
fi

REPO_URI="ghcr.io/${GITHUB_REPO_OWNER}/${IMAGE_NAME}"
# 3) find last semver tag (format: NAME@vX.Y.Z)
LAST_TAG=$(git tag --list "${IMAGE_NAME}@v*.*.*" | sort -V | tail -n1)
if [[ -n "$LAST_TAG" ]]; then
  V="${LAST_TAG#*@v}"                # strip “NAME@v”
  IFS=. read -r MAJOR MINOR PATCH <<<"$V"
else
  MAJOR=0; MINOR=0; PATCH=0
fi
# 4) bump rule from the commit title
COMMIT_TITLE=$(git log -1 --pretty=format:'%s')
if   echo "$COMMIT_TITLE" | grep -qiE "^(BREAKING CHANGE|MAJOR|!)"; then
  MAJOR=$(( MAJOR + 1 )); MINOR=0; PATCH=0
elif echo "$COMMIT_TITLE" | grep -qiE "^(feat|feature|minor)"; then
  MINOR=$(( MINOR + 1 )); PATCH=0
else
  PATCH=$(( PATCH + 1 ))
fi
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEW_TAG="${IMAGE_NAME}@v${NEW_VERSION}"

echo "  ↪︎ bumping $LAST_TAG → $NEW_VERSION"

# 5) build & push only the version tag
docker build -t "${REPO_URI}:${NEW_VERSION}" .
docker push "${REPO_URI}:${NEW_VERSION}"

# 6) annotate + push the Git tag
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
echo "$NEW_VERSION" > latest_version.txt
git push origin --tags

echo "✅ Done: pushed ${REPO_URI}:${NEW_VERSION} and tag $NEW_TAG"

echo "new_tag=${NEW_TAG}"
