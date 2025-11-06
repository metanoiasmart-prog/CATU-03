import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  LogOut, 
  Clock, 
  ArrowRightLeft, 
  CheckCircle,
  FileText,
  Settings
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar autenticación
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar el perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const operacionesCards = [
    {
      title: "Apertura de Caja",
      description: "Iniciar turno con fondo inicial",
      icon: DollarSign,
      color: "bg-primary",
      action: () => navigate("/apertura-caja"),
    },
    {
      title: "Arqueo de Caja",
      description: "Contar efectivo y cerrar turno",
      icon: Clock,
      color: "bg-secondary",
      action: () => navigate("/arqueo-caja"),
    },
    {
      title: "Traslado de Efectivo",
      description: "Enviar efectivo a Caja Principal",
      icon: ArrowRightLeft,
      color: "bg-warning",
      action: () => navigate("/traslado-efectivo"),
    },
    {
      title: "Recepción de Traslado",
      description: "Recibir efectivo en Caja Principal",
      icon: CheckCircle,
      color: "bg-secondary",
      action: () => navigate("/recepcion-traslado"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Sistema de Gestión de Efectivo</h1>
                <p className="text-sm text-muted-foreground">Tienda Catu</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{profile?.nombre_completo}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Operaciones Principales */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Operaciones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {operacionesCards.map((operacion, index) => (
              <Card 
                key={index} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={operacion.action}
              >
                <CardHeader>
                  <div className={`inline-flex p-3 rounded-lg ${operacion.color} mb-3 w-fit`}>
                    <operacion.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{operacion.title}</CardTitle>
                  <CardDescription>{operacion.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Accesos Rápidos */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate("/historial")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Historial</CardTitle>
                    <CardDescription className="text-sm">Ver operaciones anteriores</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => toast({ title: "Próximamente", description: "Reportes en desarrollo" })}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Reportes</CardTitle>
                    <CardDescription className="text-sm">Generar reportes Excel</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => toast({ title: "Próximamente", description: "Configuración en desarrollo" })}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Configuración</CardTitle>
                    <CardDescription className="text-sm">Parámetros del sistema</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
