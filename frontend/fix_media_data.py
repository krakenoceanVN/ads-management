import re

with open('src/pages/Media.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "data={db.media}\n        />",
    "data={db.media.filter((x: any) => x.name.includes(search) || x.contact.includes(search))}\n          onEdit={(row) => { openModal('newMedia'); (window as any).editData = row; }}\n        />"
)

text = text.replace(
    "data={db.mediaOrders}\n        />",
    "data={db.mediaOrders.filter((x: any) => x.name.includes(search) && (!mediaFilter || x.mediaId == mediaFilter))}\n          onEdit={(row) => { openModal('newMediaAdOrder'); (window as any).editData = row; }}\n        />"
)

with open('src/pages/Media.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
