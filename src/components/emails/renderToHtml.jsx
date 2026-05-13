const blockStyles = {
  text: 'padding: 10px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333;',
  image: 'padding: 10px; text-align: center;',
  button: 'padding: 20px; text-align: center;',
  spacer: 'padding: 10px;',
  header: 'padding: 20px; background-color: #f4f4f4; text-align: center; font-family: Arial, sans-serif;',
  footer: 'padding: 20px; background-color: #f4f4f4; text-align: center; font-family: Arial, sans-serif; font-size: 12px; color: #888;',
};

const renderBlock = (block) => {
  switch (block.type) {
    case 'text':
      return `<div style="${blockStyles.text}">${block.content.replace(/\n/g, '<br/>')}</div>`;
    case 'image':
      return `<div style="${blockStyles.image}"><img src="${block.src}" alt="${block.alt || 'Email Image'}" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>`;
    case 'button': {
      const buttonStyle = `display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; color: #fff; background-color: ${block.color || '#007bff'}; text-decoration: none; border-radius: 5px;`;
      return `<div style="${blockStyles.button}"><a href="${block.url}" style="${buttonStyle}">${block.text}</a></div>`;
    }
    case 'spacer':
      return `<div style="${blockStyles.spacer} height: ${block.height || 20}px;"></div>`;
    case 'header':
       return `<div style="${blockStyles.header}"><h1 style="margin: 0; font-size: 24px; color: #333;">${block.content}</h1></div>`;
    case 'footer':
        return `<div style="${blockStyles.footer}">${block.content}</div>`;
    default:
      return '';
  }
};

export function renderToHtml(blocks) {
  if (!Array.isArray(blocks)) return '';
  const body = blocks.map(renderBlock).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Email</title>
      </head>
      <body style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f6f6f6; width: 100%;">
          <tr>
            <td>&nbsp;</td>
            <td class="container" style="display: block; margin: 0 auto !important; max-width: 580px; padding: 10px; width: 580px;">
              <div class="content" style="box-sizing: border-box; display: block; margin: 0 auto; max-width: 580px; padding: 10px;">
                <table role="presentation" class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background: #ffffff; border-radius: 3px; width: 100%;">
                  <tr>
                    <td class="wrapper" style="box-sizing: border-box; padding: 20px;">
                      ${body}
                    </td>
                  </tr>
                </table>
              </div>
            </td>
            <td>&nbsp;</td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
