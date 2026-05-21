/** Build nodemailer attachments from uploaded files or stored URLs */
async function buildAttachments(files, fields) {
  const list = [];

  const addFile = (file) => {
    if (file?.content) {
      list.push({ filename: file.filename, content: file.content });
    }
  };

  const addUrl = async (url, name) => {
    const u = (url || '').trim();
    if (!u) return;
    try {
      const res = await fetch(u);
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      list.push({
        filename: name || u.split('/').pop() || 'attachment',
        content: buf,
      });
    } catch (e) {
      console.error('Attachment URL fetch failed:', e.message);
    }
  };

  addFile(files.globalAttachment);
  addFile(files.perRecipAttachment);

  if (!files.globalAttachment?.content && fields.globalAttachmentUrl) {
    await addUrl(fields.globalAttachmentUrl, fields.globalAttachmentName);
  }
  if (!files.perRecipAttachment?.content && fields.recipAttachmentUrl) {
    await addUrl(fields.recipAttachmentUrl, fields.recipAttachmentName);
  }

  return list;
}

module.exports = { buildAttachments };
