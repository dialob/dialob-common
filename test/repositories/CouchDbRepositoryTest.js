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

  var ajaxPromise;

  beforeEach(() => {
    ajaxPromise = {
      done: () => {
        return ajaxPromise;
      },
      fail: () => {
        return ajaxPromise;
      },
      always: () => {
        return ajaxPromise;
      },
      then: handler => {
        return ajaxPromise;
      },
      catch: handler => {
        return ajaxPromise;
      }
    };
    fetchStub = sinon.stub().returns(ajaxPromise);

    global.fetch = fetchStub;
    repository = new Repository('http://localhost:5984', 'testing', undefined, undefined, fetchStub);

  });

  describe('createUuid', () => {
    it('should request a new uuid from couchdb', () => {
      repository.createUuid();
      assert(fetchStub.calledWithMatch('http://localhost:5984/_uuids', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      }));
    });

    it('returns promise for result handling', () => {
      repository.createUuid().then(
        (data, textStatus, jqXHR) => {},
        (jqXHR, textStatus, errorThrown) => {});
      assert(fetchStub.calledWithMatch('http://localhost:5984/_uuids', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      }));
    });
  });

  describe('query.all()', () => {
    it('returns all documentids using couchdb rest api', () => {
      fetchStub.returns(ajaxPromise);
      sinon.stub(ajaxPromise,'then').returns(ajaxPromise);
      repository.query.all().then();
      sinon.assert.calledThrice(ajaxPromise.then);
      sinon.assert.calledOnce(fetch);
      assert(fetchStub.calledWithMatch('http://localhost:5984/testing', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      }));
    });
  });

  describe('delete()', () => {
    it('DELETE couchdb document using rest api', () => {
      fetchStub.returns(ajaxPromise);
      sinon.stub(ajaxPromise,'then').returns(ajaxPromise);
      repository.delete({
        _id: 'docId',
        _rev: 'docRev'
      }).then();
      sinon.assert.calledTwice(ajaxPromise.then);
      assert(fetchStub.calledWithMatch('http://localhost:5984/testing/docId',{
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'If-Match': 'docRev'
        }
      }));
    });
  });

 describe('getOrCreateId', () => {
   it('calls createUuid to generate new id if document do not have it already.', () => {
      // given
      // get uuid
      var responseMock = sinon.mock({
        json : function () {}
      });
      sinon.stub(responseMock.object,'json').returns({ uuids: ['created-uuid'] });
      responseMock.object.status = 200; 

      var thenStub = sinon.stub(ajaxPromise,'then');
      thenStub.onCall(0).yields(responseMock.object).returns(ajaxPromise);
      thenStub.onCall(1).yields(responseMock.object).returns(ajaxPromise);
      thenStub.onCall(2).yields({ uuids: ['created-uuid'] }).returns(ajaxPromise);
      fetchStub.returns(ajaxPromise);

      // when
      return repository.getOrCreateId(null).then(
        result => {
          assert(fetchStub.calledWithMatch('http://localhost:5984/_uuids',{
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json'
            }
          }));
          expect(result[0]).to.equal('created-uuid');
        }
      );
    });
    it('returns id of given document, if it exists', () => {
      // given

      // when
      repository.getOrCreateId({
        _id: 'existing-id',
        _rev: 'current-rev'
      }).then(
        (pair) => {
          assert(pair[0]).toBe('existing-id');
          assert(pair[1]).toBe('current-rev');
        }
      );
    });
  });

  describe('load', () => {
    it('loads document using gived document id', () => {
      repository.load('load-this');
      assert(fetchStub.calledWithMatch('http://localhost:5984/testing/load-this', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      }));
    });


    it('needs to catch response on http code 404', () => {
      var responseMock = sinon.mock({
        json : function () {}
      });
      sinon.stub(responseMock.object,'json').returns({ error: 'document not found' });
      responseMock.object.status = 404; 

      var catchStub = sinon.stub();
      var thenHandlerStub = sinon.stub();
      var thenStub = sinon.stub(ajaxPromise,'then');
      thenStub.onCall(0).yields(responseMock.object).returns(ajaxPromise);
      var exception = null;
      try {
        repository.load('this-dont-exists');
      } catch(e) {
        exception = e;
      }
      assert(exception != null)
      assert(exception.response != null)
      assert(fetchStub.calledWithMatch('http://localhost:5984/testing/this-dont-exists', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      }));
    });

  });

  describe('save', () => {
    it('creates an empty document, if not initial given', () => {
      // given
      // get uuid
      var responseMock = sinon.mock({
        json : function () {}
      });
      sinon.stub(responseMock.object,'json').returns({ uuids: ['new-document-uuid'] });
      responseMock.object.status = 200; 

      var thenStub = sinon.stub(ajaxPromise,'then');
      thenStub.onCall(0).yields(responseMock.object).returns(ajaxPromise);
      thenStub.onCall(1).yields(responseMock.object).returns(ajaxPromise);
      thenStub.onCall(2).yields({ uuids: ['new-document-uuid'] }).returns(ajaxPromise);
      fetchStub.returns(ajaxPromise);


      // save
      var responseMock2 = sinon.mock({
        json : function () {}
      });
      sinon.stub(responseMock2.object,'json').returns({ ok: true, id: 'new-document-uuid', rev: '1-new-document-uuid' });
      responseMock2.object.status = 200; 

      thenStub.onCall(3).yields(responseMock2.object).returns(ajaxPromise);  // checkStatus
      thenStub.onCall(4).yields(responseMock2.object).returns(ajaxPromise);  // return response.json();
      thenStub.onCall(5).yields({ ok: true, id: 'new-document-uuid', rev: '1-new-document-uuid' }).returns(ajaxPromise); //

      // when
      return repository.save().then(
        result => {
          // then
          assert.deepEqual({_id: 'new-document-uuid', _rev: '1-new-document-uuid'}, result);

          assert(fetchStub.calledWithMatch('http://localhost:5984/_uuids', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json'
            }
          }));
          assert(fetchStub.calledWithMatch('http://localhost:5984/testing/new-document-uuid', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json; charset=UTF-8'
            },
            body: sinon.match.string
          }));
      });
    });
  });

});
