import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PolÃ­tica de Privacidad - DeaMap",
  description:
    "PolÃ­tica de privacidad de DeaMap. InformaciÃ³n sobre el tratamiento de datos personales.",
  robots: { index: false, follow: false },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PolÃ­tica de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">Ãšltima actualizaciÃ³n: 4 de marzo de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              1. Responsable del tratamiento
            </h2>
            <p>
              DeaMap es un proyecto desarrollado por <strong>Global Emergency</strong>, que actÃºa
              como responsable del tratamiento de los datos personales recogidos a travÃ©s de este
              sitio web.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Sitio web:{" "}
                <a
                  href="https://www.globalemergency.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  www.globalemergency.online
                </a>
              </li>
              <li>
                Correo de protecciÃ³n de datos:{" "}
                <a
                  href="mailto:rgpd@globalemergency.online"
                  className="text-blue-600 hover:underline"
                >
                  rgpd@globalemergency.online
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              2. Datos que recopilamos
            </h2>
            <p>
              En funciÃ³n de cÃ³mo interactÃºes con DeaMap, podemos recopilar los siguientes datos:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Datos de registro:</strong> nombre, direcciÃ³n de correo electrÃ³nico y
                contraseÃ±a (almacenada de forma cifrada).
              </li>
              <li>
                <strong>Datos de ubicaciÃ³n:</strong> coordenadas geogrÃ¡ficas proporcionadas
                voluntariamente para localizar desfibriladores cercanos.
              </li>
              <li>
                <strong>Datos de uso:</strong> informaciÃ³n sobre tu interacciÃ³n con la plataforma
                (pÃ¡ginas visitadas, acciones realizadas).
              </li>
              <li>
                <strong>Datos de desfibriladores:</strong> informaciÃ³n que aportes sobre la
                ubicaciÃ³n, estado y caracterÃ­sticas de los DEAs.
              </li>
              <li>
                <strong>Datos de organizaciÃ³n:</strong> si gestionas una organizaciÃ³n, datos
                asociados como nombre de la entidad y miembros.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              3. Finalidad del tratamiento
            </h2>
            <p>Los datos personales se tratan con las siguientes finalidades:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Gestionar tu cuenta de usuario y permitir el acceso a la plataforma.</li>
              <li>Mostrar desfibriladores cercanos a tu ubicaciÃ³n.</li>
              <li>Permitir la colaboraciÃ³n en el registro y verificaciÃ³n de desfibriladores.</li>
              <li>Gestionar las organizaciones y sus miembros.</li>
              <li>Mejorar la plataforma mediante anÃ¡lisis de uso agregado.</li>
              <li>Enviar comunicaciones relacionadas con el servicio (si aplica).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              4. Base legal del tratamiento
            </h2>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Consentimiento:</strong> al registrarte y utilizar la plataforma, consientes
                el tratamiento de tus datos para las finalidades descritas.
              </li>
              <li>
                <strong>InterÃ©s legÃ­timo:</strong> mejora del servicio y seguridad de la
                plataforma.
              </li>
              <li>
                <strong>InterÃ©s pÃºblico:</strong> facilitar el acceso a desfibriladores puede
                contribuir a salvar vidas en situaciones de emergencia.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              5. ConservaciÃ³n de los datos
            </h2>
            <p>
              Los datos personales se conservarÃ¡n mientras mantengas tu cuenta activa. Si solicitas
              la eliminaciÃ³n de tu cuenta, tus datos personales serÃ¡n eliminados salvo aquellos
              que debamos conservar por obligaciÃ³n legal. Los datos de desfibriladores que hayas
              aportado podrÃ¡n mantenerse de forma anonimizada tras la eliminaciÃ³n de tu cuenta,
              dado su interÃ©s para la seguridad pÃºblica, salvo que solicites expresamente su
              retirada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              6. ComparticiÃ³n de datos
            </h2>
            <p>No vendemos tus datos personales. Podemos compartir datos con:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Proveedores de servicios:</strong> servicios de alojamiento (Vercel), base
                de datos y analÃ­tica necesarios para el funcionamiento de la plataforma.
              </li>
              <li>
                <strong>Organismos pÃºblicos:</strong> cuando sea requerido por ley o para proteger
                derechos legales.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              7. Derechos del usuario
            </h2>
            <p>De acuerdo con el RGPD, tienes derecho a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Acceso:</strong> solicitar una copia de tus datos personales.
              </li>
              <li>
                <strong>RectificaciÃ³n:</strong> corregir datos inexactos o incompletos.
              </li>
              <li>
                <strong>SupresiÃ³n:</strong> solicitar la eliminaciÃ³n de tus datos.
              </li>
              <li>
                <strong>OposiciÃ³n:</strong> oponerte al tratamiento de tus datos.
              </li>
              <li>
                <strong>Portabilidad:</strong> recibir tus datos en un formato estructurado.
              </li>
              <li>
                <strong>LimitaciÃ³n:</strong> solicitar la limitaciÃ³n del tratamiento.
              </li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, contacta con nosotros en{" "}
              <a
                href="mailto:rgpd@globalemergency.online"
                className="text-blue-600 hover:underline"
              >
                rgpd@globalemergency.online
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Menores de edad</h2>
            <p>
              DeaMap es una plataforma apta para todos los pÃºblicos. La parte pÃºblica de la
              plataforma (consulta del mapa y localizaciÃ³n de desfibriladores) puede ser utilizada
              por cualquier persona sin necesidad de registro.
            </p>
            <p className="mt-2">
              Para crear una cuenta en DeaMap, los menores de 14 aÃ±os necesitan el consentimiento
              verificable de su padre, madre o tutor legal, conforme al artÃ­culo 7 del RGPD y al
              artÃ­culo 7 de la Ley OrgÃ¡nica 3/2018 (LOPDGDD). Si eres padre, madre o tutor y crees
              que tu hijo/a menor de 14 aÃ±os nos ha proporcionado datos personales sin tu
              consentimiento, contacta con nosotros en{" "}
              <a
                href="mailto:rgpd@globalemergency.online"
                className="text-blue-600 hover:underline"
              >
                rgpd@globalemergency.online
              </a>{" "}
              y procederemos a eliminar dichos datos.
            </p>
            <p className="mt-2">
              No recopilamos deliberadamente datos personales de menores de 14 aÃ±os sin
              consentimiento parental. En la parte pÃºblica de la plataforma, limitamos el uso de
              cookies de analÃ­tica y servicios de terceros para proteger la privacidad de todos los
              usuarios, incluidos los menores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Seguridad</h2>
            <p>
              Aplicamos medidas tÃ©cnicas y organizativas para proteger tus datos, incluyendo
              cifrado de contraseÃ±as, conexiones seguras (HTTPS) y controles de acceso. No
              obstante, ningÃºn sistema es completamente seguro y no podemos garantizar la seguridad
              absoluta de la informaciÃ³n.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Cookies</h2>
            <p>
              DeaMap utiliza cookies y tecnologÃ­as similares. Para mÃ¡s informaciÃ³n, consulta
              nuestra{" "}
              <Link href="/legal/cookies" className="text-blue-600 hover:underline">
                PolÃ­tica de Cookies
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              11. Cambios en esta polÃ­tica
            </h2>
            <p>
              Podemos actualizar esta polÃ­tica de privacidad periÃ³dicamente. Cualquier cambio
              serÃ¡ publicado en esta pÃ¡gina con la fecha de actualizaciÃ³n correspondiente. Te
              recomendamos revisarla de forma periÃ³dica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta polÃ­tica de privacidad o sobre el tratamiento de tus
              datos, puedes contactarnos en{" "}
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
          <Link href="/legal/cookies" className="hover:text-gray-700 transition-colors">
            PolÃ­tica de Cookies
          </Link>
          <Link href="/legal/condiciones" className="hover:text-gray-700 transition-colors">
            Condiciones de Uso
          </Link>
          <Link href="/" className="hover:text-gray-700 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
