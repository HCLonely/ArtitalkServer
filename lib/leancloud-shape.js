function isoDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function rowToLeanCloudObject(row) {
  const objectId = row.object_id || row.objectId;
  return {
    id: objectId,
    objectId,
    createdAt: isoDate(row.created_at || row.createdAt),
    updatedAt: isoDate(row.updated_at || row.updatedAt),
    attributes: row.data || row.attributes || {}
  };
}

function publicUserFromRow(row) {
  const objectId = row.object_id || row.objectId;
  const attributes = {
    username: row.username
  };
  if (row.img) attributes.img = row.img;
  if (row.img_token) attributes.imgToken = row.img_token;
  return {
    id: objectId,
    objectId,
    sessionToken: row.session_token || row.sessionToken,
    attributes
  };
}

module.exports = {
  rowToLeanCloudObject,
  publicUserFromRow
};
