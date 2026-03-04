import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Cookies - DeaMap",
  description: "Política de cookies de DeaMap. Información sobre el uso de cookies en nuestra plataforma.",
  robots: { index: false, follow: false },
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Cookies</h1>
        <p className="text-sm text-gray-500 mb-8">Última actualización: 4 de marzo de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. ¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio
              web. Se utilizan ampliamente para hacer que los sitios web funcionen de manera más eficiente y para
              proporcionar información a los propietarios del sitio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Cookies que utilizamos</h2>
            <p>DeaMap utiliza los siguientes tipos de cookies:</p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Cookies esenciales</h3>
            <p>Son necesarias para el funcionamiento básico de la plataforma. Sin estas cookies, el sitio no puede funcionar correctamente.</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold">Cookie</th>
                    <th className="text-left py-2 pr-4 font-semibold">Finalidad</th>
                    <th className="text-left py-2 font-semibold">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4"><code className="bg-gray-100 px-1 rounded">token</code></td>
                    <td className="py-2 pr-4">Autenticación del usuario (JWT)</td>
                    <td className="py-2">Sesión</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Cookies de analítica</h3>
            <p>Nos ayudan a entender cómo los usuarios interactúan con la plataforma para poder mejorarla.</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold">Cookie</th>
                    <th className="text-left py-2 pr-4 font-semibold">Finalidad</th>
                    <th className="text-left py-2 font-semibold">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4"><code className="bg-gray-100 px-1 rounded">_ga</code></td>
                    <td className="py-2 pr-4">Google Analytics - Distinguir usuarios</td>
                    <td className="py-2">2 años</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4"><code className="bg-gray-100 px-1 rounded">_ga_*</code></td>
                    <td className="py-2 pr-4">Google Analytics - Mantener estado de sesión</td>
                    <td className="py-2">2 años</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Cookies de rendimiento</h3>
            <p>Utilizadas para monitorizar el rendimiento de la plataforma.</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold">Cookie</th>
                    <th className="text-left py-2 pr-4 font-semibold">Finalidad</th>
                    <th className="text-left py-2 font-semibold">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4"><code className="bg-gray-100 px-1 rounded">vercel-speed-insights</code></td>
                    <td className="py-2 pr-4">Vercel Speed Insights - Métricas de rendimiento</td>
                    <td className="py-2">Sesión</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Almacenamiento local</h2>
            <p>
              Además de cookies, DeaMap puede utilizar el almacenamiento local del navegador (localStorage) para
              guardar preferencias de usuario y datos de sesión. Estos datos permanecen en tu dispositivo y no se
              envían automáticamente a nuestros servidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Cookies de terceros</h2>
            <p>Algunos servicios de terceros integrados en DeaMap pueden establecer sus propias cookies:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Google Analytics:</strong> análisis de uso del sitio. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Política de privacidad de Google</a>.</li>
              <li><strong>Vercel Analytics:</strong> métricas de rendimiento y análisis web.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Cookies y menores de edad</h2>
            <p>
              DeaMap es una plataforma apta para todos los públicos. En cumplimiento de la Política de Familias de
              Google Play y la normativa de protección de menores, las cookies de analítica y seguimiento de terceros
              (como Google Analytics) pueden ser desactivadas en las secciones públicas de la plataforma accesibles
              sin registro, para proteger la privacidad de los menores de edad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. ¿Cómo gestionar las cookies?</h2>
            <p>
              Puedes controlar y eliminar las cookies a través de la configuración de tu navegador. Ten en cuenta que
              deshabilitar ciertas cookies puede afectar a la funcionalidad de la plataforma.
            </p>
            <p className="mt-2">Instrucciones para los principales navegadores:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/es/kb/cookies-informacion-que-los-sitios-web-guardan-en-" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Safari</a></li>
              <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Microsoft Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política de cookies cuando cambiemos las tecnologías que utilizamos. Cualquier
              modificación será publicada en esta página.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Contacto</h2>
            <p>
              Si tienes preguntas sobre nuestra política de cookies, contacta con nosotros en{" "}
              <a href="mailto:rgpd@globalemergency.online" className="text-blue-600 hover:underline">rgpd@globalemergency.online</a>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacidad" className="hover:text-gray-700 transition-colors">Política de Privacidad</Link>
          <Link href="/legal/condiciones" className="hover:text-gray-700 transition-colors">Condiciones de Uso</Link>
          <Link href="/" className="hover:text-gray-700 transition-colors">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
