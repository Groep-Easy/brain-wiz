echo "### 1. git diff --name-status"
git diff --name-status HEAD~1 HEAD 2>&1
echo ""

echo "### 2. find fix-*.js"
find . -name "fix-*.js" -not -path "*/node_modules/*" 2>&1
find . -name "debug-test.js" -not -path "*/node_modules/*" 2>&1
echo ""

echo "### 3. ls -la tests/reconnect/"
ls -la tests/reconnect/ 2>&1
echo ""

echo "### 4. grep host App.tsx for onclose/status/roomState/reconnect/attempt"
grep -n "onclose\|setStatus\|setRoomState\|reconnect\|attempt" src/host/App.tsx 2>&1
echo ""

echo "### 5. grep host App.tsx for ReconnectToast/WelcomeScreen"
grep -n "ReconnectToast\|WelcomeScreen" src/host/App.tsx 2>&1
echo ""

echo "### 6. npx vitest run tests/reconnect/"
npx vitest run tests/reconnect/ --reporter=verbose 2>&1
echo ""

echo "### 7. Bug 1 revert test"
git stash -- src/server/room/lobby/room-broadcaster.ts 2>&1
npx vitest run tests/reconnect/bug1-ghost-answer.test.tsx --reporter=verbose 2>&1
git stash pop 2>&1
echo ""

echo "### 8. Bug 2 revert test"
git stash -- src/client/App.tsx 2>&1
npx vitest run tests/reconnect/bug2-already-answered.test.tsx --reporter=verbose 2>&1
git stash pop 2>&1
echo ""

echo "### 9. Bug 3 revert test"
git stash -- src/host/App.tsx 2>&1
npx vitest run tests/reconnect/bug3-host-reconnect.test.tsx --reporter=verbose 2>&1
git stash pop 2>&1
echo ""

echo "### 10. Bug 4 revert test"
git stash -- src/server/room/game/answer.service.ts 2>&1
npx vitest run tests/reconnect/bug4-hostage-timer.test.ts --reporter=verbose 2>&1
git stash pop 2>&1
echo ""

echo "### 11. Full suite — final number"
npx vitest run --reporter=json 2>&1 | grep '"numPassedTests"\|"numFailedTests"\|"numTotalTests"'
echo ""

echo "### 12. Lint"
npx eslint src/ tests/ --ext .ts,.tsx 2>&1
echo ""
