/* jshint mocha: true */
'use strict';

const should = require('should');

const Sails = require('sails').Sails;
const request = require('supertest');

const docGen = require('../lib/doc-generator');

const customRoutes = {
    'get /api/test/:id': {
        controller: 'TestController',
        action: 'test',
        swagger: {
            tags: [],
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
    }
}


describe('Sails Routes Swagger', function () {

    // Var to hold a running sails app instance
    let sails;

    // Before running any tests, attempt to lift Sails
    before(function (done) {
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
                level: 'error'
            },
            routes: customRoutes,
            'sails-routes-swagger': {
            	package: require('../package'),
            	externalDocs: { url: 'localhost:3000' }
            }
        };

        Sails().lift(sailsConfig, function(err, _sails) {
            if (err) return done(err);
            sails = _sails;
            return done();
        });
    });

    after(function (done) {
        if (sails) {
            return sails.lower(done);
        }
        return done();
    });

    it('should generate swagger doc on app lift', () => {
    	let swaggerDoc = sails.hooks['sails-routes-swagger'];
        
        swaggerDoc.should.be.instanceof(Object);
        should.exist(swaggerDoc.swagger);
        should.exist(swaggerDoc.info);
        should.exist(swaggerDoc.host);
        should.exist(swaggerDoc.tags);
        should.exist(swaggerDoc.definitions);
        should.exist(swaggerDoc.securityDefinitions);
        should.exist(swaggerDoc.externalDocs);
        should.exist(swaggerDoc.paths);
    });

    it('should return swagger json', done => {
    	request(sails.hooks.http.app)
	      .get('/swagger/ui')
	      .set('Accept', 'application/json')
	      .expect('Content-Type', /json/)
	      .expect(200, done);
    });

    context('Doc Generator', () => {

    	context('generateSwaggerPathObjects', () => {

    		let testRoute = {
    			'post /api/test/:id': {
    				controller: 'TestController',
    				action: 'save',
    				swagger: {
    					tags: ['Test'],
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
