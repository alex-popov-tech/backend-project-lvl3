clean:
	rm -rf node_modules; rm package-lock.json;
install:
	npm install
setup:clean install
	npm install
publish:
	npm publish --dry-run
lint:
	npx eslint .
lint-watch:
	watch --interval 5 npx eslint .
test:
	npm test
test-coverage:
	npm test -- --coverage
test-watch:
	npx jest --watch

