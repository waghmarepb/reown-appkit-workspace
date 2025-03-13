import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { ReownConfig } from './models';
import { ReownAppKitService } from './services/reown-appkit.service';

@NgModule({
    imports: [
        HttpClientModule
    ],
    providers: [
        ReownAppKitService
    ]
})
export class ReownAppKitModule {
    static forRoot(config: ReownConfig): ModuleWithProviders<ReownAppKitModule> {
        return {
            ngModule: ReownAppKitModule,
            providers: [
                { provide: 'REOWN_CONFIG', useValue: config }
            ]
        };
    }
}