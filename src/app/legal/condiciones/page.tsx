import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones de Uso - DeaMap",
  description: "Condiciones de uso del servicio DeaMap. Términos y condiciones para el uso de la plataforma.",
  robots: { index: false, follow: false },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Condiciones de Uso</h1>
        <p className="text-sm text-gray-500 mb-8">Última actualización: 4 de marzo de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Aceptación de las condiciones</h2>
            <p>
              Al acceder y utilizar DeaMap (<a href="https://deamap.es" className="text-blue-600 hover:underline">deamap.es</a>),
              aceptas estas condiciones de uso en su totalidad. Si no estás de acuerdo con alguna de estas condiciones,
              no debes utilizar la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Descripción del servicio</h2>
            <p>
              DeaMap es una plataforma colaborativa que permite localizar, registrar y verificar desfibriladores
              externos automáticos (DEA) en España. El servicio incluye:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Mapa interactivo de desfibriladores.</li>
              <li>Búsqueda de DEAs cercanos por geolocalización.</li>
              <li>Registro colaborativo de nuevos desfibriladores.</li>
              <li>Verificación del estado de los DEAs existentes.</li>
              <li>Gestión de organizaciones responsables de desfibriladores.</li>
              <li>Importación masiva de datos de DEAs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Registro de usuario y menores de edad</h2>
            <p>Para utilizar ciertas funcionalidades de DeaMap es necesario crear una cuenta. Al registrarte, te comprometes a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Proporcionar información veraz y actualizada.</li>
              <li>Mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Notificarnos cualquier uso no autorizado de tu cuenta.</li>
              <li>Ser responsable de todas las actividades realizadas desde tu cuenta.</li>
            </ul>
            <p className="mt-3">
              <strong>Uso por menores:</strong> la parte pública de DeaMap (consultar el mapa y localizar desfibriladores)
              está disponible para cualquier persona sin restricción de edad. Para crear una cuenta, los menores de
              14 años necesitan el consentimiento de su padre, madre o tutor legal. Los usuarios de entre 14 y 17 años
              pueden registrarse por sí mismos. Los padres o tutores son responsables del uso que los menores a su cargo
              hagan de la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Uso aceptable</h2>
            <p>Te comprometes a utilizar DeaMap de forma responsable. Queda prohibido:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Introducir información falsa o engañosa sobre la ubicación o estado de desfibriladores.</li>
              <li>Utilizar la plataforma para fines ilegales o no autorizados.</li>
              <li>Intentar acceder de forma no autorizada a sistemas o datos de otros usuarios.</li>
              <li>Realizar scraping masivo o automatizado de datos sin autorización.</li>
              <li>Interferir con el funcionamiento normal de la plataforma.</li>
              <li>Suplantar la identidad de otros usuarios u organizaciones.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Contenido del usuario y propiedad de los datos</h2>
            <p>
              Los datos de desfibriladores que aportes a DeaMap (ubicaciones, imágenes, verificaciones, etc.)
              siguen siendo de tu propiedad. Al aportarlos, otorgas a DeaMap una licencia no exclusiva y gratuita
              para utilizar, mostrar y compartir públicamente dichos datos dentro de la plataforma, con el fin de
              mejorar el servicio y contribuir a la seguridad pública.
            </p>
            <p className="mt-2">
              Algunos datos de desfibriladores pueden estar sujetos a restricciones de visibilidad establecidas por
              las organizaciones o usuarios que los aportan. DeaMap respeta dichas restricciones y no compartirá
              públicamente datos marcados como restringidos.
            </p>
            <p className="mt-2">
              Eres responsable de la veracidad y legalidad del contenido que aportes. DeaMap se reserva el derecho
              de eliminar contenido que infrinja estas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Organizaciones</h2>
            <p>
              Las organizaciones registradas en DeaMap son responsables de mantener actualizados los datos de sus
              desfibriladores. Los administradores de organizaciones son responsables de gestionar los permisos
              de sus miembros y de la exactitud de la información publicada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Exención de responsabilidad</h2>
            <p>
              DeaMap es una herramienta informativa y colaborativa. La información sobre desfibriladores se
              proporciona <strong>&quot;tal cual&quot;</strong> y no podemos garantizar:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>La exactitud, integridad o actualización de la información de los DEAs.</li>
              <li>La disponibilidad o estado operativo de los desfibriladores listados.</li>
              <li>La disponibilidad continua e ininterrumpida del servicio.</li>
            </ul>
            <p className="mt-2">
              <strong>En caso de emergencia médica, llama siempre al 112.</strong> DeaMap no sustituye la asistencia
              médica profesional y no se hace responsable de las decisiones tomadas basándose en la información
              de la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Propiedad intelectual</h2>
            <p>
              El diseño, código fuente, logotipos y contenido original de DeaMap son propiedad de Global Emergency.
              Los datos de desfibriladores aportados por los usuarios son propiedad de quienes los aportan;
              DeaMap dispone de licencia de uso para mostrarlos y compartirlos en la plataforma conforme a la
              sección 5 de estas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Suspensión y cancelación</h2>
            <p>
              Nos reservamos el derecho de suspender o cancelar cuentas de usuario que infrinjan estas condiciones,
              introduzcan datos falsos de forma reiterada o hagan un uso abusivo de la plataforma, con previo aviso
              cuando sea posible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Modificaciones del servicio</h2>
            <p>
              DeaMap puede modificar, ampliar o descontinuar funcionalidades del servicio en cualquier momento.
              Se realizarán esfuerzos razonables para notificar a los usuarios sobre cambios significativos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Modificaciones de las condiciones</h2>
            <p>
              Podemos actualizar estas condiciones de uso periódicamente. Los cambios se publicarán en esta página
              con la fecha de actualización correspondiente. El uso continuado de la plataforma tras la publicación
              de los cambios constituye la aceptación de las condiciones actualizadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Legislación aplicable</h2>
            <p>
              Estas condiciones se rigen por la legislación española. Para cualquier controversia derivada del uso
              de DeaMap, las partes se someterán a los juzgados y tribunales competentes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">13. Contacto</h2>
            <p>
              Si tienes preguntas sobre estas condiciones de uso, contacta con nosotros en{" "}
              <a href="mailto:rgpd@globalemergency.online" className="text-blue-600 hover:underline">rgpd@globalemergency.online</a>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacidad" className="hover:text-gray-700 transition-colors">Política de Privacidad</Link>
          <Link href="/legal/cookies" className="hover:text-gray-700 transition-colors">Política de Cookies</Link>
          <Link href="/" className="hover:text-gray-700 transition-colors">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
