import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad - DeaMap",
  description: "Política de privacidad de DeaMap. Información sobre el tratamiento de datos personales.",
  robots: { index: false, follow: false },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">Última actualización: 4 de marzo de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Responsable del tratamiento</h2>
            <p>
              DeaMap es un proyecto desarrollado por <strong>Global Emergency</strong>, que actúa como responsable
              del tratamiento de los datos personales recogidos a través de este sitio web.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Sitio web: <a href="https://www.globalemergency.online" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.globalemergency.online</a></li>
              <li>Correo de protección de datos: <a href="mailto:rgpd@globalemergency.online" className="text-blue-600 hover:underline">rgpd@globalemergency.online</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Datos que recopilamos</h2>
            <p>En función de cómo interactúes con DeaMap, podemos recopilar los siguientes datos:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Datos de registro:</strong> nombre, dirección de correo electrónico y contraseña (almacenada de forma cifrada).</li>
              <li><strong>Datos de ubicación:</strong> coordenadas geográficas proporcionadas voluntariamente para localizar desfibriladores cercanos.</li>
              <li><strong>Datos de uso:</strong> información sobre tu interacción con la plataforma (páginas visitadas, acciones realizadas).</li>
              <li><strong>Datos de desfibriladores:</strong> información que aportes sobre la ubicación, estado y características de los DEAs.</li>
              <li><strong>Datos de organización:</strong> si gestionas una organización, datos asociados como nombre de la entidad y miembros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Finalidad del tratamiento</h2>
            <p>Los datos personales se tratan con las siguientes finalidades:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Gestionar tu cuenta de usuario y permitir el acceso a la plataforma.</li>
              <li>Mostrar desfibriladores cercanos a tu ubicación.</li>
              <li>Permitir la colaboración en el registro y verificación de desfibriladores.</li>
              <li>Gestionar las organizaciones y sus miembros.</li>
              <li>Mejorar la plataforma mediante análisis de uso agregado.</li>
              <li>Enviar comunicaciones relacionadas con el servicio (si aplica).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Base legal del tratamiento</h2>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Consentimiento:</strong> al registrarte y utilizar la plataforma, consientes el tratamiento de tus datos para las finalidades descritas.</li>
              <li><strong>Interés legítimo:</strong> mejora del servicio y seguridad de la plataforma.</li>
              <li><strong>Interés público:</strong> facilitar el acceso a desfibriladores puede contribuir a salvar vidas en situaciones de emergencia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Conservación de los datos</h2>
            <p>
              Los datos personales se conservarán mientras mantengas tu cuenta activa. Si solicitas la eliminación de
              tu cuenta, tus datos personales serán eliminados salvo aquellos que debamos conservar por obligación legal.
              Los datos de desfibriladores que hayas aportado podrán mantenerse de forma anonimizada tras la eliminación
              de tu cuenta, dado su interés para la seguridad pública, salvo que solicites expresamente su retirada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Compartición de datos</h2>
            <p>No vendemos tus datos personales. Podemos compartir datos con:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Proveedores de servicios:</strong> servicios de alojamiento (Vercel), base de datos y analítica necesarios para el funcionamiento de la plataforma.</li>
              <li><strong>Organismos públicos:</strong> cuando sea requerido por ley o para proteger derechos legales.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Derechos del usuario</h2>
            <p>De acuerdo con el RGPD, tienes derecho a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Acceso:</strong> solicitar una copia de tus datos personales.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de tus datos.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos.</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado.</li>
              <li><strong>Limitación:</strong> solicitar la limitación del tratamiento.</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, contacta con nosotros en{" "}
              <a href="mailto:rgpd@globalemergency.online" className="text-blue-600 hover:underline">rgpd@globalemergency.online</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Menores de edad</h2>
            <p>
              DeaMap es una plataforma apta para todos los públicos. La parte pública de la plataforma (consulta del
              mapa y localización de desfibriladores) puede ser utilizada por cualquier persona sin necesidad de registro.
            </p>
            <p className="mt-2">
              Para crear una cuenta en DeaMap, los menores de 14 años necesitan el consentimiento verificable de su
              padre, madre o tutor legal, conforme al artículo 7 del RGPD y al artículo 7 de la Ley Orgánica 3/2018
              (LOPDGDD). Si eres padre, madre o tutor y crees que tu hijo/a menor de 14 años nos ha proporcionado
              datos personales sin tu consentimiento, contacta con nosotros en{" "}
              <a href="mailto:rgpd@globalemergency.online" className="text-blue-600 hover:underline">rgpd@globalemergency.online</a>{" "}
              y procederemos a eliminar dichos datos.
            </p>
            <p className="mt-2">
              No recopilamos deliberadamente datos personales de menores de 14 años sin consentimiento parental.
              En la parte pública de la plataforma, limitamos el uso de cookies de analítica y servicios de
              terceros para proteger la privacidad de todos los usuarios, incluidos los menores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Seguridad</h2>
            <p>
              Aplicamos medidas técnicas y organizativas para proteger tus datos, incluyendo cifrado de contraseñas,
              conexiones seguras (HTTPS) y controles de acceso. No obstante, ningún sistema es completamente seguro
              y no podemos garantizar la seguridad absoluta de la información.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Cookies</h2>
            <p>
              DeaMap utiliza cookies y tecnologías similares. Para más información, consulta nuestra{" "}
              <Link href="/legal/cookies" className="text-blue-600 hover:underline">Política de Cookies</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política de privacidad periódicamente. Cualquier cambio será publicado en esta
              página con la fecha de actualización correspondiente. Te recomendamos revisarla de forma periódica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta política de privacidad o sobre el tratamiento de tus datos, puedes
              contactarnos en{" "}
              <a href="mailto:rgpd@globalemergency.online" className="text-blue-600 hover:underline">rgpd@globalemergency.online</a>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/cookies" className="hover:text-gray-700 transition-colors">Política de Cookies</Link>
          <Link href="/legal/condiciones" className="hover:text-gray-700 transition-colors">Condiciones de Uso</Link>
          <Link href="/" className="hover:text-gray-700 transition-colors">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
