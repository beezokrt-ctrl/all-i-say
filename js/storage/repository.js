export class ArchiveRepository {
  // Status-filtered lists use their normal kept/active defaults, even when
  // status is undefined. includeHistory: true explicitly bypasses only the
  // status filter; other filters and limits still apply.
  async open() {
    throw new Error('Not implemented: open');
  }
  async getUtterance(_id) {
    throw new Error('Not implemented: getUtterance');
  }
  async listUtterances(_filters = {
  }) {
    throw new Error('Not implemented: listUtterances');
  }
  async createUtterance(_data) {
    throw new Error('Not implemented: createUtterance');
  }
  // Creates new words and their author-declared response relation atomically.
  async createResponse(_utteranceData, _relationData) {
    throw new Error('Not implemented: createResponse');
  }
  async tombstoneUtterance(_id, _reason = null) {
    throw new Error('Not implemented: tombstoneUtterance');
  }
  async createArtifact(_blob, _meta = {
  }) {
    throw new Error('Not implemented: createArtifact');
  }
  async getArtifact(_id) {
    throw new Error('Not implemented: getArtifact');
  }
  async listArtifacts() {
    throw new Error('Not implemented: listArtifacts');
  }
  async createTranscription(_data) {
    throw new Error('Not implemented: createTranscription');
  }
  async listTranscriptions(_filters = {
  }) {
    throw new Error('Not implemented: listTranscriptions');
  }
  async confirmTranscription(_id, _attestation = {
  }) {
    throw new Error('Not implemented: confirmTranscription');
  }
  async createRelation(_data) {
    throw new Error('Not implemented: createRelation');
  }
  async listRelations(_filters = {
  }) {
    throw new Error('Not implemented: listRelations');
  }
  async withdrawRelation(_id, _reason = null) {
    throw new Error('Not implemented: withdrawRelation');
  }
  async createConstellation(_data) {
    throw new Error('Not implemented: createConstellation');
  }
  async createConstellationWithMembership(_constellationData, _membershipData) {
    throw new Error('Not implemented: createConstellationWithMembership');
  }
  async getConstellation(_id) {
    throw new Error('Not implemented: getConstellation');
  }
  async listConstellations(_filters = {
  }) {
    throw new Error('Not implemented: listConstellations');
  }
  async createMembership(_data) {
    throw new Error('Not implemented: createMembership');
  }
  async listMemberships(_filters = {
  }) {
    throw new Error('Not implemented: listMemberships');
  }
  async withdrawMembership(_id, _reason = null) {
    throw new Error('Not implemented: withdrawMembership');
  }
  async getSchemaVersion() {
    throw new Error('Not implemented: getSchemaVersion');
  }
  async getExportSnapshot() {
    throw new Error('Not implemented: getExportSnapshot');
  }
  async getLastBackupExport() {
    throw new Error('Not implemented: getLastBackupExport');
  }
  async recordBackupExport(_receipt) {
    throw new Error('Not implemented: recordBackupExport');
  }
  async exportAll() {
    throw new Error('Not implemented: exportAll');
  }
  async importAll(_payload, _options = {
  }) {
    throw new Error('Not implemented: importAll');
  }
}
