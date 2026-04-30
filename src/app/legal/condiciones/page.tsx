import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones de Uso - DeaMap",
  description:
    "Condiciones de uso del servicio DeaMap. TÃ©rminos y condiciones para el uso de la plataforma.",
  robots: { index: false, follow: false },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Condiciones de Uso</h1>
        <p className="text-sm text-gray-500 mb-8">Ãšltima actualizaciÃ³n: 4 de marzo de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              1. AceptaciÃ³n de las condiciones
            </h2>
            <p>
              Al acceder y utilizar DeaMap (
              <a href="https://deamap.es" className="text-blue-600 hover:underline">
                deamap.es
              </a>
              ), aceptas estas condiciones de uso en su totalidad. Si no estÃ¡s de acuerdo con
              alguna de estas condiciones, no debes utilizar la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              2. DescripciÃ³n del servicio
            </h2>
            <p>
              DeaMap es una plataforma colaborativa que permite localizar, registrar y verificar
              desfibriladores externos automÃ¡ticos (DEA) en EspaÃ±a. El servicio incluye:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Mapa interactivo de desfibriladores.</li>
              <li>BÃºsqueda de DEAs cercanos por geolocalizaciÃ³n.</li>
              <li>Registro colaborativo de nuevos desfibriladores.</li>
              <li>VerificaciÃ³n del estado de los DEAs existentes.</li>
              <li>GestiÃ³n de organizaciones responsables de desfibriladores.</li>
              <li>ImportaciÃ³n masiva de datos de DEAs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              3. Registro de usuario y menores de edad
            </h2>
            <p>
              Para utilizar ciertas funcionalidades de DeaMap es necesario crear una cuenta. Al
              registrarte, te comprometes a:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Proporcionar informaciÃ³n veraz y actualizada.</li>
              <li>Mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Notificarnos cualquier uso no autorizado de tu cuenta.</li>
              <li>Ser responsable de todas las actividades realizadas desde tu cuenta.</li>
            </ul>
            <p className="mt-3">
              <strong>Uso por menores:</strong> la parte pÃºblica de DeaMap (consultar el mapa y
              localizar desfibriladores) estÃ¡ disponible para cualquier persona sin restricciÃ³n de
              edad. Para crear una cuenta, los menores de 14 aÃ±os necesitan el consentimiento de su
              padre, madre o tutor legal. Los usuarios de entre 14 y 17 aÃ±os pueden registrarse por
              sÃ­ mismos. Los padres o tutores son responsables del uso que los menores a su cargo
              hagan de la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Uso aceptable</h2>
            <p>Te comprometes a utilizar DeaMap de forma responsable. Queda prohibido:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Introducir informaciÃ³n falsa o engaÃ±osa sobre la ubicaciÃ³n o estado de
                desfibriladores.
              </li>
              <li>Utilizar la plataforma para fines ilegales o no autorizados.</li>
              <li>Intentar acceder de forma no autorizada a sistemas o datos de otros usuarios.</li>
              <li>Realizar scraping masivo o automatizado de datos sin autorizaciÃ³n.</li>
              <li>Interferir con el funcionamiento normal de la plataforma.</li>
              <li>Suplantar la identidad de otros usuarios u organizaciones.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              5. Contenido del usuario y propiedad de los datos
            </h2>
            <p>
              Los datos de desfibriladores que aportes a DeaMap (ubicaciones, imÃ¡genes,
              verificaciones, etc.) siguen siendo de tu propiedad. Al aportarlos, otorgas a DeaMap
              una licencia no exclusiva y gratuita para utilizar, mostrar y compartir pÃºblicamente
              dichos datos dentro de la plataforma, con el fin de mejorar el servicio y contribuir a
              la seguridad pÃºblica.
            </p>
            <p className="mt-2">
              Algunos datos de desfibriladores pueden estar sujetos a restricciones de visibilidad
              establecidas por las organizaciones o usuarios que los aportan. DeaMap respeta dichas
              restricciones y no compartirÃ¡ pÃºblicamente datos marcados como restringidos.
            </p>
            <p className="mt-2">
              Eres responsable de la veracidad y legalidad del contenido que aportes. DeaMap se
              reserva el derecho de eliminar contenido que infrinja estas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Organizaciones</h2>
            <p>
              Las organizaciones registradas en DeaMap son responsables de mantener actualizados los
              datos de sus desfibriladores. Los administradores de organizaciones son responsables
              de gestionar los permisos de sus miembros y de la exactitud de la informaciÃ³n
              publicada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              7. ExenciÃ³n de responsabilidad
            </h2>
            <p>
              DeaMap es una herramienta informativa y colaborativa. La informaciÃ³n sobre
              desfibriladores se proporciona <strong>&quot;tal cual&quot;</strong> y no podemos
              garantizar:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>La exactitud, integridad o actualizaciÃ³n de la informaciÃ³n de los DEAs.</li>
              <li>La disponibilidad o estado operativo de los desfibriladores listados.</li>
              <li>La disponibilidad continua e ininterrumpida del servicio.</li>
            </ul>
            <p className="mt-2">
              <strong>En caso de emergencia mÃ©dica, llama siempre al 112.</strong> DeaMap no
              sustituye la asistencia mÃ©dica profesional y no se hace responsable de las decisiones
              tomadas basÃ¡ndose en la informaciÃ³n de la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              8. Propiedad intelectual
            </h2>
            <p>
              El diseÃ±o, cÃ³digo fuente, logotipos y contenido original de DeaMap son propiedad de
              Global Emergency. Los datos de desfibriladores aportados por los usuarios son
              propiedad de quienes los aportan; DeaMap dispone de licencia de uso para mostrarlos y
              compartirlos en la plataforma conforme a la secciÃ³n 5 de estas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              9. SuspensiÃ³n y cancelaciÃ³n
            </h2>
            <p>
              Nos reservamos el derecho de suspender o cancelar cuentas de usuario que infrinjan
              estas condiciones, introduzcan datos falsos de forma reiterada o hagan un uso abusivo
              de la plataforma, con previo aviso cuando sea posible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              10. Modificaciones del servicio
            </h2>
            <p>
              DeaMap puede modificar, ampliar o descontinuar funcionalidades del servicio en
              cualquier momento. Se realizarÃ¡n esfuerzos razonables para notificar a los usuarios
              sobre cambios significativos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              11. Modificaciones de las condiciones
            </h2>
            <p>
              Podemos actualizar estas condiciones de uso periÃ³dicamente. Los cambios se
              publicarÃ¡n en esta pÃ¡gina con la fecha de actualizaciÃ³n correspondiente. El uso
              continuado de la plataforma tras la publicaciÃ³n de los cambios constituye la
              aceptaciÃ³n de las condiciones actualizadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              12. LegislaciÃ³n aplicable
            </h2>
            <p>
              Estas condiciones se rigen por la legislaciÃ³n espaÃ±ola. Para cualquier controversia
              derivada del uso de DeaMap, las partes se someterÃ¡n a los juzgados y tribunales
              competentes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">13. Contacto</h2>
            <p>
              Si tienes preguntas sobre estas condiciones de uso, contacta con nosotros en{" "}
              <a
                href="mailto:rgpd@globalemergency.online"
                className="text-blue-600 hover:underline"
              >
                rgpd@globalemergency.online
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacidad" className="hover:text-gray-700 transition-colors">
            PolÃ­tica de Privacidad
          </Link>
          <Link href="/legal/cookies" className="hover:text-gray-700 transition-colors">
            PolÃ­tica de Cookies
          </Link>
          <Link href="/" className="hover:text-gray-700 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
