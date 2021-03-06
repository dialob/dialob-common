/* global fetch */
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
import Immutable from 'immutable';

function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }
  return response.json().then(response => Promise.reject(response));
}

export default class CouchDbRepository {
  constructor(couchDbUrl, databaseName, csrf, csrfHeader, doFetch = fetch) {
    if (typeof couchDbUrl === 'function') {
      this.couchDbUrl = couchDbUrl;
    } else if (typeof couchDbUrl === 'string') {
      this.couchDbUrl = () => couchDbUrl;
    } else {
      console.error('couchDbUrl must be string or function');
    }
    this.databaseName = databaseName;
    this.csrfHeader = {};
    if (csrf && csrfHeader) {
      this.csrfHeader[csrfHeader] = csrf;
    }
    this.doFetch = doFetch;
  }

  server(resource) {
    var url = () => this.couchDbUrl() + (resource ? '/' + resource : '');
    var parent = this;
    var doFetch = this.doFetch;
    var serverApi = {
      url: url,
      get: () => {
        var headers = Object.assign({
          Accept: 'application/json'
        }, parent.csrfHeader);
        return doFetch(url(), {
          method: 'GET',
          credentials: 'same-origin',
          headers: headers
        }).then(checkStatus);
      }
    };
    return serverApi;
  }

  database(documentId) {
    var url = path => {
      return this.server(this.databaseName).url() + (path ? '/' + path : '');
    };
    var _rev;
    var parent = this;
    var doFetch = this.doFetch;
    var databaseApi = {
      url: url,
      get: (path, params) => {
        var headers = Object.assign({
          Accept: 'application/json'
        }, parent.csrfHeader);
        let queryString = "";
        if (params) {
          queryString = "?" + Object.keys(params).map(key => params[key] && `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).filter(p => !!p).join('&');
        }
        return doFetch(url(path || documentId) + queryString, {
          method: 'GET',
          credentials: 'same-origin',
          headers: headers
        })
        .then(checkStatus)
        .then(response => response.json());
      },
      rev: rev => {
        _rev = rev;
        return databaseApi;
      },
      delete: () => {
        var headers = Object.assign({
          'If-Match': _rev
        }, parent.csrfHeader);
        return doFetch(url(documentId), {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: headers
        }).then(checkStatus);
      },
      put: document => {
        var headers = Object.assign({
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json'
        }, parent.csrfHeader);
        return doFetch(url(documentId), {
          method: 'PUT',
          credentials: 'same-origin',
          headers: headers,
          body: JSON.stringify(document)
        }).then(checkStatus);
      }
    };
    return databaseApi;
  }

  getOrCreateId(document) {
    let id = this.getId(document);
    if (id) {
      return Promise.resolve([id, this.getRev(document)]); // eslint-disable-line no-undef
    }
    return this.createUuid()
      .then(
        response => response.json()
      ).then(
        response => [response.uuids[0], null]
      );
  }

  getId(document) {
    if (!document) {
      return undefined;
    }
    if (Immutable.Map.isMap(document)) {
      return document.get('_id');
    }
    return document._id;
  }

  getRev(document) {
    if (Immutable.Map.isMap(document)) {
      return document.get('_rev');
    }
    return document._rev;
  }

  createUuid() {
    return this.server('_uuids').get();
  }

  get query() {
    return {
      all: params => {
        return this.database().get(undefined, params);
      },
      allDocs: params => {
        return this.database().get('_all_docs', params);
      },
      design: (design) => {
        return {
          view: (view, params) => {
            return this.database().get(`_design/${design}/_view/${view}`, params);
          }
        };
      }
    };
  }

  delete(document) {
    return this.database(this.getId(document))
      .rev(this.getRev(document))
      .delete();
  }

  load(documentId) {
    return this.database(documentId).get();
  }

  _save(document) {
    return this.database(this.getId(document)).put(document);
  }

  newDocument(id) {
    return {
      _id: id
    };
  }
  _updateDocumentRev(updateDocument, _id, _rev) {
    let document = updateDocument;
    if (Immutable.Map.isMap(document)) {
      document = document.set('_id', _id);
      if (_rev) {
        document = document.set('_rev', _rev);
      } else {
        document = document.delete('_rev');
      }
    } else {
      document._id = _id;
      if (_rev) {
        document._rev = _rev;
      }
    }
    return document;
  }

  save(document) {
    return this.getOrCreateId(document)
      .then(pair => {
        document = document || this.newDocument(pair[0]);
        document = this._updateDocumentRev(document, pair[0], pair[1]);
        return this._save(document)
          .then(response => response.json())
          .then(revInfo => {
            if (revInfo.ok) {
              return {_id: revInfo.id, _rev: revInfo.rev};
            }
            return Promise.reject(revInfo);
          });
      });
  }

}
