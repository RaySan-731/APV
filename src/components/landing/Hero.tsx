import { Button } from "@/components/ui/button";
import { Mountain, ArrowRight, Users, Award, Map, Heart } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-hero opacity-10" />
      
      {/* Content */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <Mountain className="h-16 w-16 text-primary animate-pulse" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6">
            Empowering Young{" "}
            <span className="text-transparent bg-clip-text bg-gradient-forest">
              Leaders
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            Empowering ventures through strategic planning, resource management, and business excellence.
            Professional training programs for schools across the nation.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/book">
              <Button variant="hero" size="lg" className="group">
                Book a Program
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/programs">
              <Button variant="outline" size="lg">
                Explore Programs
              </Button>
            </Link>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            <div className="bg-card p-6 rounded-lg shadow-card">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="text-3xl font-bold text-foreground">500+</h3>
              <p className="text-muted-foreground">Students Trained</p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-card">
              <Award className="h-8 w-8 text-accent mx-auto mb-2" />
              <h3 className="text-3xl font-bold text-foreground">25+</h3>
              <p className="text-muted-foreground">Partner Schools</p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-card">
              <Map className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="text-3xl font-bold text-foreground">100+</h3>
              <p className="text-muted-foreground">Adventures Led</p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-card">
              <Heart className="h-8 w-8 text-accent mx-auto mb-2" />
              <h3 className="text-3xl font-bold text-foreground">98%</h3>
              <p className="text-muted-foreground">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}