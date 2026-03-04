import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { getAppUrl } from "./url";

let _sesClient: SESClient | null = null;

/**
 * Returns the shared SESClient singleton.
 * Lazily initialized on first call.
 */
function getSESClient(): SESClient {
  if (!_sesClient) {
    if (
      !process.env.AWS_REGION ||
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        "AWS SES is not properly configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY"
      );
    }

    _sesClient = new SESClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _sesClient;
}

export interface SendPasswordResetEmailParams {
  to: string;
  resetToken: string;
  userName: string;
}

export async function sendPasswordResetEmail({
  to,
  resetToken,
  userName,
}: SendPasswordResetEmailParams): Promise<void> {
  const resetUrl = `${getAppUrl()}/reset-password?token=${resetToken}`;

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not configured");
  }

  const sesClient = getSESClient();

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de contraseña</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 30px;">
                    <h1 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: bold;">
                      Recuperación de contraseña
                    </h1>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                      Hola ${userName},
                    </p>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                      Recibimos una solicitud para restablecer tu contraseña en DeaMap. Si no fuiste tú quien hizo esta solicitud, puedes ignorar este correo.
                    </p>
                    <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                      Para restablecer tu contraseña, haz clic en el siguiente botón:
                    </p>
                    <table role="presentation" style="border-collapse: collapse; margin: 0 0 30px 0;">
                      <tr>
                        <td style="border-radius: 4px; background-color: #007bff;">
                          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">
                            Restablecer contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                      O copia y pega este enlace en tu navegador:
                    </p>
                    <p style="margin: 0 0 30px 0; color: #007bff; font-size: 14px; word-break: break-all;">
                      ${resetUrl}
                    </p>
                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px; line-height: 1.5;">
                      Este enlace expirará en 1 hora por razones de seguridad.
                    </p>
                    <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.5;">
                      Si no solicitaste restablecer tu contraseña, por favor ignora este correo.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} DeaMap. Todos los derechos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const textBody = `
Hola ${userName},

Recibimos una solicitud para restablecer tu contraseña en DeaMap. Si no fuiste tú quien hizo esta solicitud, puedes ignorar este correo.

Para restablecer tu contraseña, copia y pega el siguiente enlace en tu navegador:

${resetUrl}

Este enlace expirará en 1 hora por razones de seguridad.

Si no solicitaste restablecer tu contraseña, por favor ignora este correo.

© ${new Date().getFullYear()} DeaMap. Todos los derechos reservados.
  `;

  const command = new SendEmailCommand({
    Source: process.env.EMAIL_FROM,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: "Recuperación de contraseña - DeaMap",
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: "UTF-8",
        },
        Text: {
          Data: textBody,
          Charset: "UTF-8",
        },
      },
    },
  });

  try {
    await sesClient.send(command);
  } catch (error) {
    console.error("Error sending password reset email via AWS SES:", error);
    throw new Error("Failed to send password reset email");
  }
}
