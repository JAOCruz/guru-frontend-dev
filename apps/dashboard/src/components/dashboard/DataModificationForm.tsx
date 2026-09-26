import React, { useState, useEffect } from "react";
import { servicesAPI } from "../../services/api";
import { preventDecimalInput } from "../../utils";
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardContent, NeoCardFooter } from "@guru/ui";
import { NeoInput } from "@guru/ui";
import { NeoSelect } from "@guru/ui";
import { NeoButton } from "@guru/ui";
import { Plus, X, Loader2 } from "lucide-react";

interface DataModificationFormProps {
  onServiceAdded: () => void;
  workers: string[];
}

const SERVICE_LIST = [
  "Redaccion documento",
  "Redaccion documento legal",
  "Redaccion traduccion",
  "Modificacion Documento",
  "Notarizacion Documento",
  "Redaccion especializada",
  "Grabar CD",
  "Impresion",
  "Escaner Documentos",
  "Diseño",
  "Solicitud Certificacion",
  "Deposito documentos online",
  "Mensajeria",
  "Propina",
  "Comision",
  "Extra (por llegar temprano)",
  "Extra (por ser explicativo)",
  "Extra (por empatia al cliente)",
  "Extra (por ofertar nuestros servicios)",
];

const DataModificationForm: React.FC<DataModificationFormProps> = ({
  onServiceAdded,
  workers,
}) => {
  const [selectedUser, setSelectedUser] = useState<string>(workers[0] ?? "");
  useEffect(() => {
    if (!workers.includes(selectedUser)) setSelectedUser(workers[0] ?? "");
  }, [workers, selectedUser]);
  const [serviceName, setServiceName] = useState<string>(SERVICE_LIST[0]);
  const [client, setClient] = useState<string>("");
  const [earnings, setEarnings] = useState<string>("");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!serviceName.trim()) {
      setError("Por favor seleccione un servicio");
      setLoading(false);
      return;
    }

    const earningsNum = Number(earnings);
    if (isNaN(earningsNum) || earningsNum <= 0) {
      setError("Por favor ingrese una ganancia válida");
      setLoading(false);
      return;
    }

    try {
      await servicesAPI.createService({
        username: selectedUser,
        serviceName,
        client: client || undefined,
        earnings: earningsNum,
      });

      setServiceName(SERVICE_LIST[0]);
      setClient("");
      setEarnings("");
      setIsFormOpen(false);
      onServiceAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al agregar servicio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <NeoCard>
      <NeoCardHeader className="flex-row items-center justify-between">
        <NeoCardTitle>Modificar Datos</NeoCardTitle>
        <NeoButton
          type="button"
          variant={isFormOpen ? "neutral" : "default"}
          onClick={() => setIsFormOpen(!isFormOpen)}
          size="sm"
        >
          {isFormOpen ? <X size={16} /> : <Plus size={16} />}
          {isFormOpen ? "Cancelar" : "Agregar Servicio"}
        </NeoButton>
      </NeoCardHeader>

      {isFormOpen && (
        <NeoCardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-base border-2 border-red-600 bg-red-50 p-4 text-center text-base font-bold text-red-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="user"
                  className="block text-sm font-black uppercase tracking-wider text-foreground/80"
                >
                  Usuario
                </label>
                <NeoSelect
                  id="user"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  {workers.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </NeoSelect>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="service"
                  className="block text-sm font-black uppercase tracking-wider text-foreground/80"
                >
                  Servicio
                </label>
                <NeoSelect
                  id="service"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                >
                  {SERVICE_LIST.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </NeoSelect>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="client"
                  className="block text-sm font-black uppercase tracking-wider text-foreground/80"
                >
                  Cliente (Opcional)
                </label>
                <NeoInput
                  type="text"
                  id="client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="earnings"
                  className="block text-sm font-black uppercase tracking-wider text-foreground/80"
                >
                  Ganancia
                </label>
                <NeoInput
                  type="number"
                  id="earnings"
                  value={earnings}
                  onChange={(e) => setEarnings(e.target.value)}
                  placeholder="Ej: 500"
                  min="0"
                  step="1"
                  onKeyDown={preventDecimalInput}
                />
              </div>
            </div>

            <NeoCardFooter className="justify-end">
              <NeoButton
                type="button"
                variant="neutral"
                onClick={() => setIsFormOpen(false)}
                disabled={loading}
              >
                Cancelar
              </NeoButton>
              <NeoButton type="submit" variant="default" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </NeoButton>
            </NeoCardFooter>
          </form>
        </NeoCardContent>
      )}
    </NeoCard>
  );
};

export default DataModificationForm;
