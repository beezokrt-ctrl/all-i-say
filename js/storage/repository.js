/**
 * Repository boundary for the archive.
 *
 * Views and services depend on this contract, never on a concrete storage
 * adapter. The absence of an utterance update method is intentional: text is
 * immutable after creation.
 */
export class NotImplementedError extends Error {
  constructor(method) {
    super(`${method} is not implemented by this repository`);
    this.name = 'NotImplementedError';
  }
}

export class ArchiveRepository {
  async getUtterance(id) { throw new NotImplementedError('getUtterance'); }
  async listUtterances(_filters = {}) { throw new NotImplementedError('listUtterances'); }
  async createUtterance(_data) { throw new NotImplementedError('createUtterance'); }
  async tombstoneUtterance(_id, _reason) { throw new NotImplementedError('tombstoneUtterance'); }

  async getArtifact(id) { throw new NotImplementedError('getArtifact'); }
  async createArtifact(_blob, _meta) { throw new NotImplementedError('createArtifact'); }

  async createTranscription(_data) { throw new NotImplementedError('createTranscription'); }
  async confirmTranscription(_id, _attestation = {}) { throw new NotImplementedError('confirmTranscription'); }

  async createAnnotation(_data) { throw new NotImplementedError('createAnnotation'); }
  async createInterpretation(_data) { throw new NotImplementedError('createInterpretation'); }
  async createRelation(_data) { throw new NotImplementedError('createRelation'); }
  async withdrawRelation(_id, _reason) { throw new NotImplementedError('withdrawRelation'); }

  async createSuggestion(_data) { throw new NotImplementedError('createSuggestion'); }
  async acceptSuggestion(_id) { throw new NotImplementedError('acceptSuggestion'); }
  async rejectSuggestion(_id, _options = {}) { throw new NotImplementedError('rejectSuggestion'); }

  async search(_query) { throw new NotImplementedError('search'); }
  async exportAll() { throw new NotImplementedError('exportAll'); }
  async importAll(_payload, _options = {}) { throw new NotImplementedError('importAll'); }
  async getSchemaVersion() { throw new NotImplementedError('getSchemaVersion'); }
  async migrate(_targetVersion) { throw new NotImplementedError('migrate'); }
}
