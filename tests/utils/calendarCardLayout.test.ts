import {expect,it} from 'vitest'
import {layoutCalendarCards} from '../../utils/calendarCardLayout'
const obj=(name:string,height:number,extra:any={})=>({name,parentFrameId:'f',left:0,top:10,width:300,height,scaleY:1,strokeWidth:0,visible:true,text:'text',set(v:any){Object.assign(this,v)},getBoundingRect(){return{top:this.top,left:this.left,width:this.width,height:this.height+this.strokeWidth}},...extra})
it('recolhe uma data curta e o aviso desativado, sem mover a base nem acumular altura',()=>{
 const card=obj('standard-validity-background',180,{strokeWidth:3})
 const date=obj('header-validity',40,{quickValidityLayout:'calendar-card',fontSize:32})
 const heading=obj('validity-heading',20), stock=obj('stock-validity',18)
 const objects=[card,date,heading,stock,obj('reference-validity-heading-band',20),obj('reference-validity-stock-band',18)]
 const bottom=card.top+card.height+card.strokeWidth
 expect(layoutCalendarCards(objects)).toBe(true)
 const first=card.height
 expect(first).toBeLessThan(180)
 expect(card.top+card.height+card.strokeWidth).toBeCloseTo(bottom)
 expect(layoutCalendarCards(objects)).toBe(false)
 stock.visible=false
 layoutCalendarCards(objects)
 expect(card.height).toBeLessThan(first)
 expect(card.top+card.height+card.strokeWidth).toBeCloseTo(bottom)
 date.height=80
 layoutCalendarCards(objects)
 expect(card.height).toBeGreaterThan(first)
})
