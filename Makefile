clean:
	rm -rf node_modules; rm package-lock.json;

install:
	npm install

setup: clean install

publish:
	npm publish --dry-run

lint:
	npx eslint .

lint-watch:
	watch --interval 5 npx eslint .

test:
	DEBUG=axios,page:loader npm test -s

test-coverage:
	npm test -- --coverage

test-watch:
	npm test -- --watch

