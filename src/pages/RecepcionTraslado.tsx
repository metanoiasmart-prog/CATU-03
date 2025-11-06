import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Loader2, AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RecepcionTraslado = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [trasladosPendientes, setTrasladosPendientes] = useState<any[]>([]);
  const [trasladoSeleccionado, setTrasladoSeleccionado] = useState<any>(null);
  const [umbralDiferencia, setUmbralDiferencia] = useState(2.00);

  const [formData, setFormData] = useState({
    montoRecibido: "",
    comentario: "",
  });

  const [diferencia, setDiferencia] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.montoRecibido && trasladoSeleccionado) {
      const recibido = parseFloat(formData.montoRecibido);
      const esperado = trasladoSeleccionado.monto;
      setDiferencia(recibido - esperado);
    } else {
      setDiferencia(null);
    }
  }, [formData.montoRecibido, trasladoSeleccionado]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Obtener umbral de diferencia
      const { data: umbralParam } = await supabase
        .from("parametros")
        .select("valor")
        .eq("clave", "umbral_diferencia")
        .single();

      if (umbralParam) {
        setUmbralDiferencia(parseFloat(umbralParam.valor));
      }

      // Cargar traslados pendientes
      const { data: trasladosData } = await supabase
        .from("traslados")
        .select(`
          id,
          monto,
          estado,
          fecha_hora_envio,
          caja_origen:cajas!traslados_caja_origen_id_fkey(nombre, ubicacion),
          caja_destino:cajas!traslados_caja_destino_id_fkey(nombre, ubicacion),
          arqueos!inner(
            id,
            aperturas!inner(
              turnos!inner(
                profiles!inner(nombre_completo)
              )
            )
          )
        `)
        .eq("estado", "en_transito")
        .order("fecha_hora_envio", { ascending: true });

      if (trasladosData) {
        setTrasladosPendientes(trasladosData);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const calcularTiempoTransito = (fechaEnvio: string) => {
    const envio = new Date(fechaEnvio);
    const ahora = new Date();
    const minutos = Math.floor((ahora.getTime() - envio.getTime()) / 60000);
    return minutos;
  };

  const handleRecibir = async () => {
    if (!trasladoSeleccionado) return;

    const requiereComentario = diferencia !== null && Math.abs(diferencia) !== 0;
    if (requiereComentario && !formData.comentario.trim()) {
      toast({
        title: "Comentario requerido",
        description: "Debes agregar un comentario cuando hay diferencia en el monto recibido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const montoRecibido = parseFloat(formData.montoRecibido);
      const diferenciaFinal = montoRecibido - trasladoSeleccionado.monto;

      // Crear recepción
      const { error: recepcionError } = await supabase
        .from("recepciones")
        .insert({
          traslado_id: trasladoSeleccionado.id,
          usuario_receptor_id: userId,
          monto_recibido: montoRecibido,
          diferencia: diferenciaFinal,
          comentario: formData.comentario || null,
        });

      if (recepcionError) throw recepcionError;

      // Actualizar estado del traslado
      const nuevoEstado = diferenciaFinal === 0 ? "recibido" : "observado";
      const { error: trasladoError } = await supabase
        .from("traslados")
        .update({ estado: nuevoEstado })
        .eq("id", trasladoSeleccionado.id);

      if (trasladoError) throw trasladoError;

      toast({
        title: "¡Traslado recibido!",
        description: `Estado: ${nuevoEstado === "recibido" ? "Recibido" : "Observado (con diferencia)"}`,
      });

      // Limpiar formulario y recargar
      setFormData({ montoRecibido: "", comentario: "" });
      setTrasladoSeleccionado(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando traslados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Recepción de Traslado</h1>
                <p className="text-sm text-muted-foreground">Caja Principal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {trasladosPendientes.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay traslados pendientes de recepción en este momento.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Traslados Pendientes</h2>
              <div className="grid gap-4">
                {trasladosPendientes.map((traslado) => {
                  const minutosTransito = calcularTiempoTransito(traslado.fecha_hora_envio);
                  const alertaTransito = minutosTransito > 30;

                  return (
                    <Card 
                      key={traslado.id}
                      className={`cursor-pointer transition-all ${
                        trasladoSeleccionado?.id === traslado.id 
                          ? "ring-2 ring-primary" 
                          : "hover:shadow-md"
                      }`}
                      onClick={() => {
                        setTrasladoSeleccionado(traslado);
                        setFormData({ montoRecibido: traslado.monto.toString(), comentario: "" });
                      }}
                    >
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              De: {traslado.caja_origen.nombre}
                            </p>
                            <p className="font-medium text-lg">
                              ${traslado.monto.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              {minutosTransito} min
                            </Badge>
                            {alertaTransito && (
                              <Badge variant="destructive">¡Alerta!</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Enviado: {new Date(traslado.fecha_hora_envio).toLocaleString()}</p>
                          <p>Por: {traslado.arqueos.aperturas.turnos.profiles.nombre_completo}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {trasladoSeleccionado && (
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Recepción</CardTitle>
                  <CardDescription>
                    Verifica el monto recibido y confirma la recepción
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="montoRecibido">Monto Recibido (USD)</Label>
                      <Input
                        id="montoRecibido"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.montoRecibido}
                        onChange={(e) => setFormData({ ...formData, montoRecibido: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    {diferencia !== null && diferencia !== 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Diferencia detectada: ${diferencia.toFixed(2)}</strong>
                          <p className="mt-1 text-sm">
                            El traslado será marcado como "Observado". Debes agregar un comentario.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="comentario">
                        Comentario {diferencia !== 0 && diferencia !== null && <span className="text-destructive">*</span>}
                      </Label>
                      <Textarea
                        id="comentario"
                        value={formData.comentario}
                        onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                        placeholder="Observaciones sobre la recepción..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTrasladoSeleccionado(null);
                          setFormData({ montoRecibido: "", comentario: "" });
                        }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleRecibir} 
                        disabled={loading}
                        className="flex-1"
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar Recepción
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RecepcionTraslado;
