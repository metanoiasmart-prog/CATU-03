import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRightLeft, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TrasladoEfectivo = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [ultimoArqueo, setUltimoArqueo] = useState<any>(null);
  const [cajaDestino, setCajaDestino] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Buscar último arqueo sin traslado
      const { data: arqueosData } = await supabase
        .from("arqueos")
        .select(`
          id,
          monto_contado,
          diferencia,
          fecha_hora,
          aperturas!inner (
            id,
            turno_id,
            turnos!inner (
              id,
              caja_id,
              cajas!inner (
                id,
                nombre,
                tipo
              )
            )
          ),
          traslados (id)
        `)
        .is("traslados.id", null)
        .order("fecha_hora", { ascending: false })
        .limit(1);

      if (arqueosData && arqueosData.length > 0) {
        const arqueo = arqueosData[0];
        setUltimoArqueo({
          id: arqueo.id,
          monto: arqueo.monto_contado,
          diferencia: arqueo.diferencia,
          fecha_hora: arqueo.fecha_hora,
          caja_origen: arqueo.aperturas.turnos.cajas,
        });

        // Obtener caja principal (destino)
        const { data: cajaPrincipal } = await supabase
          .from("cajas")
          .select("*")
          .eq("tipo", "principal")
          .single();

        setCajaDestino(cajaPrincipal);
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

  const handleCrearTraslado = async () => {
    if (!ultimoArqueo || !cajaDestino) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("traslados")
        .insert({
          arqueo_id: ultimoArqueo.id,
          caja_origen_id: ultimoArqueo.caja_origen.id,
          caja_destino_id: cajaDestino.id,
          monto: ultimoArqueo.monto,
          estado: "en_transito",
        });

      if (error) throw error;

      toast({
        title: "¡Traslado creado!",
        description: "El efectivo está en tránsito a Caja Principal",
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

  if (!ultimoArqueo) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold">Traslado de Efectivo</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay arqueos pendientes de traslado. Debes realizar un arqueo de caja antes de crear un traslado.
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/arqueo-caja")} className="mt-4">
            Ir a Arqueo de Caja
          </Button>
        </main>
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
              <div className="p-2 bg-warning rounded-lg">
                <ArrowRightLeft className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Traslado de Efectivo</h1>
                <p className="text-sm text-muted-foreground">Enviar a Caja Principal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Último Arqueo Realizado</CardTitle>
            <CardDescription>
              Este efectivo será trasladado a la Caja Principal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Caja Origen:</span>
              <span className="font-medium">{ultimoArqueo.caja_origen.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Caja Destino:</span>
              <span className="font-medium">{cajaDestino?.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha y hora:</span>
              <span className="font-medium">
                {new Date(ultimoArqueo.fecha_hora).toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-lg">Monto a trasladar:</span>
                <span className="font-bold text-2xl text-primary">
                  ${ultimoArqueo.monto.toFixed(2)}
                </span>
              </div>
            </div>
            {ultimoArqueo.diferencia !== 0 && (
              <Alert variant={Math.abs(ultimoArqueo.diferencia) > 2 ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Diferencia en arqueo: ${ultimoArqueo.diferencia.toFixed(2)}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confirmar Traslado</CardTitle>
            <CardDescription>
              El traslado quedará en estado "En Tránsito" hasta que sea recibido en la Caja Principal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Asegúrate de colocar el efectivo en el sobre/bolsa correspondiente antes de confirmar el traslado.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCrearTraslado} 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Traslado
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TrasladoEfectivo;
