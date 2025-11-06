import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ArqueoCaja = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [aperturaActiva, setAperturaActiva] = useState<any>(null);
  const [umbralDiferencia, setUmbralDiferencia] = useState(2.00);
  
  const [formData, setFormData] = useState({
    montoContado: "",
    comentario: "",
  });

  const [diferencia, setDiferencia] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.montoContado && aperturaActiva) {
      const contado = parseFloat(formData.montoContado);
      const esperado = aperturaActiva.monto_inicial;
      setDiferencia(contado - esperado);
    } else {
      setDiferencia(null);
    }
  }, [formData.montoContado, aperturaActiva]);

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

      // Buscar apertura activa
      const { data: turnosData } = await supabase
        .from("turnos")
        .select(`
          id,
          fecha,
          hora_inicio,
          cajas (nombre, ubicacion),
          aperturas (
            id,
            monto_inicial,
            cerrada,
            fecha_hora
          )
        `)
        .eq("usuario_id", user.id)
        .eq("estado", "abierto")
        .order("created_at", { ascending: false });

      if (turnosData && turnosData.length > 0) {
        const turnoConApertura = turnosData.find((t: any) => 
          t.aperturas && t.aperturas.length > 0 && !t.aperturas[0].cerrada
        );

        if (turnoConApertura) {
          setAperturaActiva({
            turno_id: turnoConApertura.id,
            apertura_id: turnoConApertura.aperturas[0].id,
            monto_inicial: turnoConApertura.aperturas[0].monto_inicial,
            caja: turnoConApertura.cajas,
            fecha: turnoConApertura.fecha,
            hora_inicio: turnoConApertura.hora_inicio,
          });
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!aperturaActiva) {
      toast({
        title: "Error",
        description: "No hay apertura activa para realizar arqueo",
        variant: "destructive",
      });
      return;
    }

    // Validar comentario si diferencia supera umbral
    if (diferencia !== null && Math.abs(diferencia) > umbralDiferencia && !formData.comentario.trim()) {
      toast({
        title: "Comentario requerido",
        description: `La diferencia supera $${umbralDiferencia}. Debes agregar un comentario.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const montoContado = parseFloat(formData.montoContado);
      const montoEsperado = aperturaActiva.monto_inicial;
      const diferenciaFinal = montoContado - montoEsperado;

      // Crear arqueo
      const { error: arqueoError } = await supabase
        .from("arqueos")
        .insert({
          apertura_id: aperturaActiva.apertura_id,
          monto_contado: montoContado,
          monto_esperado: montoEsperado,
          diferencia: diferenciaFinal,
          comentario: formData.comentario || null,
        });

      if (arqueoError) throw arqueoError;

      // Cerrar apertura
      const { error: aperturaError } = await supabase
        .from("aperturas")
        .update({ cerrada: true })
        .eq("id", aperturaActiva.apertura_id);

      if (aperturaError) throw aperturaError;

      // Cerrar turno
      const { error: turnoError } = await supabase
        .from("turnos")
        .update({ 
          estado: "cerrado",
          hora_fin: new Date().toTimeString().slice(0, 5)
        })
        .eq("id", aperturaActiva.turno_id);

      if (turnoError) throw turnoError;

      toast({
        title: "¡Arqueo completado!",
        description: "El turno ha sido cerrado correctamente",
      });

      navigate("/");
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
          <p className="mt-4 text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!aperturaActiva) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold">Arqueo de Caja</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tienes ninguna apertura activa. Debes abrir una caja antes de realizar un arqueo.
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/apertura-caja")} className="mt-4">
            Ir a Apertura de Caja
          </Button>
        </main>
      </div>
    );
  }

  const requiereComentario = diferencia !== null && Math.abs(diferencia) > umbralDiferencia;

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
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Arqueo de Caja</h1>
                <p className="text-sm text-muted-foreground">Cierre de turno</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Información del Turno Activo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Caja:</span>
              <span className="font-medium">{aperturaActiva.caja.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha:</span>
              <span className="font-medium">{new Date(aperturaActiva.fecha).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora inicio:</span>
              <span className="font-medium">{aperturaActiva.hora_inicio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto inicial:</span>
              <span className="font-medium text-lg">${aperturaActiva.monto_inicial.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conteo de Efectivo</CardTitle>
            <CardDescription>
              Registra el monto total contado en caja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="montoContado">Monto Contado (USD)</Label>
                <Input
                  id="montoContado"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.montoContado}
                  onChange={(e) => setFormData({ ...formData, montoContado: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              {diferencia !== null && (
                <Alert variant={Math.abs(diferencia) > umbralDiferencia ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Diferencia: ${diferencia.toFixed(2)}</strong>
                    {Math.abs(diferencia) > umbralDiferencia && (
                      <p className="mt-1 text-sm">
                        Supera el umbral de $±{umbralDiferencia.toFixed(2)}. Es obligatorio agregar un comentario.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="comentario">
                  Comentario {requiereComentario && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="comentario"
                  value={formData.comentario}
                  onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                  placeholder="Explica el motivo de la diferencia si existe..."
                  rows={3}
                  required={requiereComentario}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generar Arqueo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ArqueoCaja;
