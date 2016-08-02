/* jshint mocha: true */
'use strict';

const should = require('should');

const Sails = require('sails').Sails;
const request = require('supertest');
const path = require('path');
const fs = require('fs-extra');

const docGen = require('../lib/doc-generator');

const customRoutes = {
    'get /api/test/:id': {
        controller: 'TestController',
        action: 'test',
        swagger: {
            tags: [],
            project: 'Test',
            summary: 'Some Test Summary',
            description: 'Some Test Description',
            operationId: 'addPet',
            consumes: ['application/json'],
            produces: ['application/json'],
            parameters: [{
				name 			: 'id',
				in 				: 'path',
				description 	: 'ID of pet to return',
				required 		: true,
				type 			: 'integer',
				format 			: 'int64'
			}],
            responses: {
                405: {
                    description: "Invalid input",
                    schema: {}
                }
            }
        }
    },
    'post /api/test': 'TestController.save'
}

const outputFolder = path.resolve(__dirname, 'docs');


describe('Sails Routes Swagger', function () {

    // Var to hold a running sails app instance
    let sails;

    // Before running any tests, attempt to lift Sails
    before(function () {
        this.timeout(11000);

        let sailsConfig = {
            hooks: {
                'sails-routes-swagger': require('../index'),
                grunt       : false,
		        orm         : false,
		        pubsub      : false,
		        sockets     : false,
		        i18n        : false,
		        async       : false,
		        blueprints  : false
            },
            log: {
                level: 'verbose'
            },
            routes: customRoutes,
            'sails-routes-swagger': {
            	package 		: require('../package'),
            	externalDocs 	: { url: 'localhost:3000' },
            	docsFolder 		: outputFolder,
            	projects 		: [{ name: 'Test' }]
            }
        };

        return new Promise((resolve, reject) => {
        	/*
        	* Ensures that a directory is empty. Deletes directory contents if the directory is not empty. 
        	* If the directory does not exist, it is created. The directory itself is not deleted.
        	*/
        	fs.emptyDir(outputFolder, (err) => {
        		if(err) {
        			reject(err);
        		} else {
        			resolve();
        		}
        	})
        }).then(() => {
        	return new Promise((resolve, reject) => {
        		Sails().lift(sailsConfig, (err, _sails) => {
		            if (err) {
		            	reject(err);
		            } else {
		            	sails = _sails;
		            	resolve()
		            }
		        });
        	})
        });
    });

    after(function (done) {
        if (sails) {
            return sails.lower(done);
        }
        return done();
    });

    it.skip('should remove all "swagger" properties from routes objects', () => {
    	let routes = sails.config.routes;
    	Object.keys(routes).forEach(path => {
    		should.not.exist(routes[path].swagger);
    	});
    });

    context('Project Docs', () => {
    	let allJSONPath 	= path.resolve(outputFolder, 'all.json'),
    		testJSONPath 	= path.resolve(outputFolder, 'test.json'),
    		swagerUrl 		= '/swagger/ui/';

    	it('should create all.json & test.json', () => {
    		let stats = fs.statSync(allJSONPath);

    		stats.isFile().should.be.true;

    		stats = fs.statSync(testJSONPath);

    		stats.isFile().should.be.true;
	    });	

	    it('should return all.json', done => {
	    	request(sails.hooks.http.app)
	      		.get(swagerUrl + 'all')
	      		.set('Accept', 'application/json')
	      		.expect('Content-Type', /json/)
	      		.expect(resp => {
	      			JSON.stringify(resp.body).should.equal(
	      				JSON.stringify(JSON.parse(fs.readFileSync(allJSONPath).toString('utf8')))
	      			)
	      		})
	      		.expect(200, done);
	    });	

	    it('should return test.json', done => {
	    	request(sails.hooks.http.app)
	      		.get(swagerUrl + 'test')
	      		.set('Accept', 'application/json')
	      		.expect('Content-Type', /json/)
	      		.expect(resp => {
	      			JSON.stringify(resp.body).should.equal(
	      				JSON.stringify(JSON.parse(fs.readFileSync(testJSONPath).toString('utf8')))
	      			)
	      		})
	      		.expect(200, done)
	    });	

	    it('should return 404 if file not exists', done => {
	    	request(sails.hooks.http.app)
	      		.get(swagerUrl + 'unknown')
	      		.expect(404, done)
	    });
    });

    context('Doc Generator', () => {

    	context('generateSwaggerPathObjects', () => {

    		let swaggerPathObj = {
  				tags: ['Test'],
  				project: 'TestProjectName',
		        summary: 'Some Test Summary',
		        description: 'Some Test Description',
		        operationId: 'addPet',
		        consumes: ['application/json'],
		        produces: ['application/json'],
		        parameters: [{
					name 			: 'id',
					in 				: 'path',
					description 	: 'ID of pet to return',
					required 		: true,
					type 			: 'integer',
					format 			: 'int64'
				}],
		        responses: {
		            405: {
		                description: "Invalid input",
		                schema: {}
		            }
		        }
   			};

    		let testRoute = {
    			'post /api/test/:id': {
    				controller: 'TestController',
    				action: 'save',
    				swagger: swaggerPathObj
    			}
    		};

    		it('should generate pathsObject', () => {
    			let result = docGen.generateSwaggerPathObjects(testRoute);

    			should.exist(result);
    			should.exist(result.paths);
    			should.exist(result.tags);

    			result.tags.length.should.equal(0);

    			should.exist(result.paths['/api/test/{id}']);

    			let path = result.paths['/api/test/{id}'].post;
    			should.exist(path);
    		});

    		it('should ignore route without swagger property', () => {
    			let result = docGen.generateSwaggerPathObjects({
    				'post /api/test/:id': {
    					controller: 'TestController',
    					action: 'save'
    				}
    			});

    			should.exist(result);
    			should.exist(result.paths);
    			should.exist(result.tags);

    			result.tags.length.should.equal(0);
    			Object.keys(result.paths).length.should.equal(0);
    		});

    		it('should create tag name', () => {
    			testRoute['post /api/test/:id'].swagger = swaggerPathObj;
    			delete testRoute['post /api/test/:id'].swagger.tags;

    			let result = docGen.generateSwaggerPathObjects(testRoute);

    			should.exist(result);
    			should.exist(result.paths);
    			should.exist(result.tags);

    			result.tags.length.should.equal(1);
    			result.tags[0].name.should.equal('TestController');
    			result.tags[0].description.should.equal('TestController');

    			should.exist(result.paths['/api/test/{id}']);

    			let path = result.paths['/api/test/{id}'].post;
    			should.exist(path);
    			should.exist(path.tags);
    			path.tags.length.should.equal(1);
    			path.tags[0].should.equal('TestController');
    		});

    		it('should generate pathsObject for specified project name', () => {
    			let projectName = 'TestProjectName';

    			let result = docGen.generateSwaggerPathObjects(testRoute, projectName);

    			should.exist(result);
    			should.exist(result.paths);
    			should.exist(result.tags);

    			result.tags.length.should.equal(0);

    			should.exist(result.paths['/api/test/{id}']);

    			let path = result.paths['/api/test/{id}'].post;
    			should.exist(path);
    		});
    	});

    	context('convertPackageToSwagger', () => {
    		it('should convert package.json content to swagger.info obj', () => {
	    		let result = docGen.convertPackageToSwagger(require('../package'));	

	    		should.exist(result);	

	    		should.exist(result.title);
	    		should.exist(result.description);
	    		should.exist(result.version);
	    		should.exist(result.contact);
	    		should.exist(result.contact.name);
	    		should.exist(result.contact.url);
	    		should.exist(result.license);
	    		should.exist(result.license.name);
    		});
    	});

    	context('mergeTags', () => {
    		it('should merge tags', () => {
    			let result = docGen.mergeTags([
    				{ name: 'Tag1', description: 'Some Description 1'},
    				{ name: 'Tag2', description: 'Lorem Ipsum'}
    			], [
    				{ name: 'Tag3', description: 'Some Description 2'},
    				{ name: 'Tag2', description: 'Some Text'}
    			]);

    			should.exist(result);
    			result.length.should.equal(3);

    			result[0].name.should.equal('Tag1');
    			result[1].name.should.equal('Tag2');
    			result[1].description.should.equal('Lorem Ipsum');		
    			result[2].name.should.equal('Tag3');
    		});
    	});
    });
});
