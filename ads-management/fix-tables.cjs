const fs = require('fs');

['SmInputTable.tsx', 'S360InputTable.tsx', 'BaiduInputTable.tsx', 'OtherInputTable.tsx'].forEach(f => {
  const file = 'src/components/daily-input/' + f;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/<SaveBar dirtyCount=\{dirtyCount\}.*?\/>/g, '');

  const lastIndex = f === 'SmInputTable.tsx' ? 3 : 1;
  
  // Need to find exactly `<Table.Summary.Cell index={lastIndex}> ... </Table.Summary.Cell>`
  const regex = new RegExp(`(<Table\\.Summary\\.Cell index=\\{${lastIndex}\\}>[\\s\\S]*?<\\/Table\\.Summary\\.Cell>)`);
  
  const insert = `
                  <Table.Summary.Cell index={${lastIndex + 1}} colSpan={2} align="right" style={{ padding: 0, position: 'sticky', right: 0, background: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: '100%', width: '100%' }}>
                      <SaveBar dirtyCount={dirtyCount} loading={mutation.isPending} onSave={handleSave} />
                    </div>
                  </Table.Summary.Cell>`;

  content = content.replace(regex, `$1${insert}`);
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});