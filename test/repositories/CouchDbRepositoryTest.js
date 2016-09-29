/* eslint-env node, mocha */
/**
 *  Copyright 2016 ReSys OÜ
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Repository = require('../../src/repositories/CouchDbRepository').default;

const sinon = require('sinon');
const assert = require('chai').assert;
const expect = require('chai').expect;

describe('Repository', () => {
  var fetchStub;

  var repository;

  var jsonStub;

  beforeEach(() => {
    fetchStub = sinon.stub();
    jsonStub = sinon.stub();
    fetchStub.returns(Promise.resolve({
      status: 200,
      json: jsonStub
    }));
    jsonStub.returns(Promise.resolve({}));
    global.fetch = fetchStub;
    repository = new Repository('http://localhost:5984', 'testing', undefined, undefined, fetchStub);
  });

  describe('createUuid', () => {
    it('should request a new uuid from couchdb', () => {
      return repository.createUuid().then(response => {
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/_uuids', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      });
    });

    it('returns promise for result handling', () => {
      return repository.createUuid().then(response => {
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/_uuids', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      });
    });
  });

  describe('query.all()', () => {
    it('returns all documentids using couchdb rest api', () => {
      return repository.query.all().then(result => {
        sinon.assert.calledOnce(fetchStub);
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      });
    });
  });

  describe('query.allDocs()', () => {
    it('returns all documentids using couchdb rest api', () => {
      return repository.query.allDocs().then(result => {
        sinon.assert.calledOnce(fetchStub);
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/_all_docs', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      });
    });
  });

  describe('query.design("d").view("v")', () => {
    it('call design view on couchdb rest api', () => {
      return repository.query.design("d").view("v").then(() => {
        sinon.assert.calledOnce(fetchStub);
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/_design/d/_view/v', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      });
    });
  });

  describe('delete()', () => {
    it('DELETE couchdb document using rest api', () => {
      return repository.delete({
        _id: 'docId',
        _rev: 'docRev'
      }).then(response => {
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/docId', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            'If-Match': 'docRev'
          }
        });
      });
    });
  });

  describe('getOrCreateId', () => {
    it('calls createUuid to generate new id if document do not have it already.', () => {
      // given
      // get uuid
      var responseMock = sinon.mock({
        json: () => {}
      });
      sinon.stub(responseMock.object, 'json').returns(Promise.resolve({uuids: ['created-uuid']}));
      responseMock.object.status = 200;

      fetchStub.returns(Promise.resolve(responseMock.object));

      // when
      return repository.getOrCreateId(null).then(
        result => {
          sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/_uuids', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json'
            }
          });
          expect(result[0]).to.equal('created-uuid');
        }
      );
    });
    it('returns id of given document, if it exists', done => {
      // given
      let thenStub = sinon.stub();

      // when
      repository.getOrCreateId({
        _id: 'existing-id',
        _rev: 'current-rev'
      }).then(thenStub).then(() => {
        sinon.assert.calledWithMatch(thenStub, ['existing-id', 'current-rev']);
        done();
      });
    });
  });

  describe('load', () => {
    it('document using gived document id', () => {
      repository.load('load-this').then(response => {
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/load-this', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      });
    });

    it('needs to catch response on http code 404', done => {
      var responseMock = sinon.mock({
        json: () => {}
      });
      sinon.stub(responseMock.object, 'json').returns(Promise.resolve({error: 'document not found', status: 404}));
      responseMock.object.status = 404;
      fetchStub.returns(Promise.resolve(responseMock.object));

      repository.load('this-dont-exists').catch(error => {
        expect(error.status).to.equal(404);
        expect(error.error).to.equal('document not found');
        sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/this-dont-exists', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });
      }).then(done);
    });
  });

  describe('save', () => {
    it('creates an empty document, if not initial given', () => {
      // given
      // get uuid
      var getUidsResponseMock = sinon.mock({
        json: () => {}
      });
      sinon.stub(getUidsResponseMock.object, 'json').returns(Promise.resolve({uuids: ['new-document-uuid']}));
      getUidsResponseMock.object.status = 200;
      fetchStub.onCall(0).returns(Promise.resolve(getUidsResponseMock.object));

      // save
      var putDocumentResponseMock = sinon.mock({
        json: () => {}
      });
      sinon.stub(putDocumentResponseMock.object, 'json').returns(Promise.resolve({ok: true, id: 'new-document-uuid', rev: '1-new-document-uuid'}));
      putDocumentResponseMock.object.status = 200;
      fetchStub.onCall(1).returns(Promise.resolve(putDocumentResponseMock.object));

      // when
      return repository.save().then(
        result => {
          // then
          assert.deepEqual({_id: 'new-document-uuid', _rev: '1-new-document-uuid'}, result);

          sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/_uuids', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json'
            }
          });
          sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/new-document-uuid', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json; charset=UTF-8'
            },
            body: sinon.match.string
          });
        }
      );
    });
  });

  describe('database', () => {
    describe('get', () => {
      it('should GET document from database', () => {
        return repository.database().get('docId').then(() => {
          sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/docId', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json'
            }
          });
        });
      });
    });
    describe('put', () => {
      it('should handle BAD REQUEST response', done => {
        let badRequestResponse = sinon.mock({
          json: () => {}
        });
        sinon.stub(badRequestResponse.object, 'json').returns(Promise.resolve({ok: false, status: 400}));
        badRequestResponse.object.status = 400;
        fetchStub.onCall(0).returns(Promise.resolve(badRequestResponse.object));
        fetchStub.returns(Promise.resolve(badRequestResponse.object));
        repository.database('123').put({_id: '123', _rev: '-1'}).catch(error => {
          sinon.assert.calledWithMatch(fetchStub, 'http://localhost:5984/testing/123', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json'
            }
          });
          expect(error.ok).to.equal(false);
          expect(error.status).to.equal(400);
          done();
        });
      });
    });
  });
});
