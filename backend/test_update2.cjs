const { updateMediaId } = require('./dist/modules/bff/media-ids/mediaId.write.service');
(async () => {
  const r = await updateMediaId('asd_xaQcn9_lOfjIG', {
    customPrice: 77.7,
    pctHal: 0.42,
    mediaAdTypeCode: 'sm',
    mediaIdName: 'update-via-service',
  });
  console.log('Result:', JSON.stringify(r, null, 2));
})();
